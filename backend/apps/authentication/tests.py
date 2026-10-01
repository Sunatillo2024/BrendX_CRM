"""Authentication tests - roles, PIN login, throttling, no public signup."""
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.stores.models import Store

from .models import PinAttempt, User


class UserFactoryMixin:
    def make_user(self, username='cashier1', role=User.ROLE_CASHIER, pin='1234',
                  password='StrongPass!234'):
        store, _ = Store.objects.get_or_create(code='TEST', defaults={'name': 'Test'})
        user = User(store=store if role != 'platform_admin' else None, username=username, role=role, first_name=username.title())
        user.set_password(password)
        if pin:
            user.set_pin(pin)
        user.save()
        return user


class RoleModelTests(UserFactoryMixin, TestCase):
    def test_owner_has_full_financial_access(self):
        owner = self.make_user('owner1', User.ROLE_OWNER)
        self.assertTrue(owner.is_owner)
        self.assertTrue(owner.can_view_financials)

    def test_manager_cannot_view_financials(self):
        manager = self.make_user('mgr1', User.ROLE_MANAGER)
        self.assertTrue(manager.is_manager)
        self.assertFalse(manager.can_view_financials)

    def test_cashier_is_most_restricted(self):
        cashier = self.make_user('cash1', User.ROLE_CASHIER)
        self.assertTrue(cashier.is_cashier)
        self.assertFalse(cashier.is_manager)
        self.assertFalse(cashier.can_view_financials)


class PinStorageTests(UserFactoryMixin, TestCase):
    """Requirement: PIN must never be stored in clear text."""

    def test_pin_is_hashed_not_plaintext(self):
        user = self.make_user(pin='0808')
        user.refresh_from_db()
        self.assertNotEqual(user.pin_hash, '0808')
        self.assertNotIn('0808', user.pin_hash)
        self.assertTrue(user.pin_hash.startswith(('pbkdf2_', 'argon2', 'bcrypt')))
        self.assertTrue(user.check_pin('0808'))
        self.assertFalse(user.check_pin('0809'))

    def test_pin_never_appears_in_audit_log(self):
        user = self.make_user(pin='4321')
        client = APIClient()
        client.post(reverse('pin-login'), {'store_code': 'TEST', 'pin': '9999'}, format='json')
        client.post(reverse('pin-login'), {'store_code': 'TEST', 'pin': '4321'}, format='json')
        for entry in AuditLog.objects.all():
            self.assertNotIn('4321', str(entry.details))
            self.assertNotIn('9999', str(entry.details))


class PinLoginTests(UserFactoryMixin, TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('pin-login')
        self.user = self.make_user(pin='0808')

    def test_login_with_correct_pin(self):
        response = self.client.post(self.url, {'store_code': 'TEST', 'pin': '0808'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['role'], User.ROLE_CASHIER)

    def test_wrong_pin_is_rejected(self):
        response = self.client.post(self.url, {'store_code': 'TEST', 'pin': '1111'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn('access', response.data)

    def test_inactive_employee_cannot_log_in(self):
        self.user.is_active = False
        self.user.save()
        response = self.client.post(self.url, {'store_code': 'TEST', 'pin': '0808'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_successful_login_is_audited(self):
        self.client.post(self.url, {'store_code': 'TEST', 'pin': '0808'}, format='json')
        self.assertTrue(
            AuditLog.objects.filter(action=AuditLog.ACTION_LOGIN, username=self.user.username).exists()
        )


class PinThrottleTests(UserFactoryMixin, TestCase):
    """Requirement: brute-force protection on the PIN endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse('pin-login')
        self.make_user(pin='0808')

    def test_lockout_after_repeated_failures(self):
        from django.conf import settings
        for _ in range(settings.PIN_MAX_ATTEMPTS):
            response = self.client.post(self.url, {'store_code': 'TEST', 'pin': '0000'}, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # The correct PIN is now refused as well - the IP is locked.
        locked = self.client.post(self.url, {'store_code': 'TEST', 'pin': '0808'}, format='json')
        self.assertEqual(locked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('retry_after', locked.data)

    def test_attempts_are_recorded(self):
        self.client.post(self.url, {'store_code': 'TEST', 'pin': '0000'}, format='json')
        self.assertEqual(PinAttempt.objects.filter(was_success=False).count(), 1)


class EmployeeManagementTests(UserFactoryMixin, TestCase):
    """Requirement: only the owner creates employees; no public registration."""

    def setUp(self):
        self.client = APIClient()
        self.owner = self.make_user('owner', User.ROLE_OWNER, pin='0001')
        self.manager = self.make_user('manager', User.ROLE_MANAGER, pin='0002')
        self.cashier = self.make_user('cashier', User.ROLE_CASHIER, pin='0003')

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_owner_can_create_employee_with_pin(self):
        self._auth(self.owner)
        response = self.client.post('/api/auth/users/', {
            'username': 'aziza', 'first_name': 'Aziza', 'role': User.ROLE_CASHIER,
            'pin': '7788', 'password': 'StrongPass!234',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        created = User.objects.get(username='aziza')
        self.assertTrue(created.check_pin('7788'))
        self.assertTrue(created.pin_hash != '7788')

    def test_duplicate_pin_is_rejected(self):
        self._auth(self.owner)
        response = self.client.post('/api/auth/users/', {
            'username': 'aziza', 'role': User.ROLE_CASHIER, 'pin': '0001',
            'password': 'StrongPass!234',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('pin', response.data)

    def test_manager_cannot_create_employee(self):
        self._auth(self.manager)
        response = self.client.post('/api/auth/users/', {
            'username': 'nope', 'role': User.ROLE_CASHIER, 'pin': '5566',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cashier_cannot_create_employee(self):
        self._auth(self.cashier)
        response = self.client.post('/api/auth/users/', {
            'username': 'nope', 'role': User.ROLE_CASHIER, 'pin': '5566',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_public_registration_endpoint_does_not_exist(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'selfsignup', 'password': 'StrongPass!234',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(User.objects.filter(username='selfsignup').exists())

    def test_owner_can_reset_an_employee_pin(self):
        self._auth(self.owner)
        response = self.client.post(f'/api/auth/users/{self.cashier.pk}/set_pin/', {
            'pin': '9090', 'pin_confirm': '9090',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cashier.refresh_from_db()
        self.assertTrue(self.cashier.check_pin('9090'))

    def test_pin_change_is_audited(self):
        self._auth(self.owner)
        self.client.post(f'/api/auth/users/{self.cashier.pk}/set_pin/', {
            'pin': '9090', 'pin_confirm': '9090',
        }, format='json')
        entry = AuditLog.objects.filter(action=AuditLog.ACTION_PIN_CHANGED).first()
        self.assertIsNotNone(entry)
        self.assertNotIn('9090', str(entry.details))

    def test_employee_can_change_own_pin(self):
        self._auth(self.cashier)
        response = self.client.post('/api/auth/users/change_pin/', {
            'current_pin': '0003', 'pin': '4545', 'pin_confirm': '4545',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_employee_deactivate_keeps_history(self):
        self._auth(self.owner)
        response = self.client.delete(f'/api/auth/users/{self.cashier.pk}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.cashier.refresh_from_db()
        self.assertFalse(self.cashier.is_active)
        self.assertTrue(User.objects.filter(pk=self.cashier.pk).exists())


class LanguagePreferenceTests(UserFactoryMixin, TestCase):
    """Requirement: the chosen language is remembered per employee."""

    def test_language_can_be_updated(self):
        user = self.make_user()
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.patch('/api/auth/users/me/', {'language': 'ru'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.language, 'ru')

    def test_supported_languages(self):
        from django.conf import settings
        self.assertEqual(settings.SUPPORTED_LANGUAGES, ['uz', 'ru'])
        self.assertNotIn('en', settings.SUPPORTED_LANGUAGES)


# The admin templates use {% static %}; in tests no collectstatic has run, so fall
# back to the plain storage instead of the manifest one.
@override_settings(STATICFILES_STORAGE='django.contrib.staticfiles.storage.StaticFilesStorage')
class AdminPinLoginTests(UserFactoryMixin, TestCase):
    """The Django admin is reached with a PIN, not a username/password form."""

    def setUp(self):
        self.owner = self.make_user('owner-admin', User.ROLE_PLATFORM_ADMIN, pin='0808')
        self.owner.is_staff = True
        self.owner.is_superuser = True
        self.owner.language = 'ru'
        self.owner.save()

    def test_login_page_renders_pin_form(self):
        response = self.client.get('/admin/login/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="pin"')
        self.assertNotContains(response, 'name="password"')

    def test_pin_logs_staff_into_admin(self):
        response = self.client.post('/admin/login/', {'store_code': 'TEST', 'pin': '0808'}, follow=False)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('admin:index'))
        # Preferred language is applied to the admin.
        self.assertEqual(response.cookies['django_language'].value, 'ru')
        self.assertEqual(self.client.get('/admin/').status_code, 200)

    def test_wrong_pin_is_rejected(self):
        response = self.client.post('/admin/login/', {'store_code': 'TEST', 'pin': '9999'})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('_auth_user_id', self.client.session)

    def test_non_staff_employee_cannot_use_admin_pin(self):
        self.make_user('cashier-admin-pin', User.ROLE_CASHIER, pin='5555')
        response = self.client.post('/admin/login/', {'store_code': 'TEST', 'pin': '5555'})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('_auth_user_id', self.client.session)
