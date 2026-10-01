"""Products tests - categories, products (no Brand), barcodes, POS search."""
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.authentication.models import User


class CatalogBase(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = self._user('owner', User.ROLE_OWNER)
        self.manager = self._user('manager', User.ROLE_MANAGER)
        self.cashier = self._user('cashier', User.ROLE_CASHIER)

    def _user(self, username, role):
        user = User(username=username, role=role, first_name=username.title())
        user.set_password('StrongPass!234')
        user.set_pin('0000' if role == User.ROLE_OWNER else '1111')
        user.save()
        return user

    def auth(self, user):
        self.client.force_authenticate(user=user)


class CategoryTests(CatalogBase):
    def test_owner_creates_category(self):
        self.auth(self.owner)
        response = self.client.post('/api/products/categories/',
                                    {'name': 'Futbolka'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['name'], 'Futbolka')

    def test_manager_creates_category(self):
        self.auth(self.manager)
        response = self.client.post('/api/products/categories/',
                                    {'name': 'Rubashka'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_cashier_cannot_create_category(self):
        self.auth(self.cashier)
        response = self.client.post('/api/products/categories/',
                                    {'name': 'Nope'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_category_update_and_list(self):
        self.auth(self.owner)
        created = self.client.post('/api/products/categories/', {'name': 'Bruki'}, format='json')
        response = self.client.patch(f"/api/products/categories/{created.data['id']}/",
                                     {'name': 'Bruki klassik'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        listing = self.client.get('/api/products/categories/')
        self.assertEqual(listing.status_code, status.HTTP_200_OK)

    def test_category_in_use_is_deactivated_not_deleted(self):
        self.auth(self.owner)
        category_id = self.client.post('/api/products/categories/',
                                       {'name': 'Kurtka'}, format='json').data['id']
        self.client.post('/api/products/', {
            'name': 'Kurtka Qish', 'category': category_id,
            'base_selling_price': '450000', 'base_cost_price': '300000',
            'variants': [],
        }, format='json')
        response = self.client.delete(f'/api/products/categories/{category_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['deactivated'])

    def test_empty_category_is_deleted(self):
        self.auth(self.owner)
        category_id = self.client.post('/api/products/categories/',
                                       {'name': 'Shorts'}, format='json').data['id']
        response = self.client.delete(f'/api/products/categories/{category_id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class ProductTests(CatalogBase):
    def setUp(self):
        super().setUp()
        self.auth(self.owner)
        self.category_id = self.client.post(
            '/api/products/categories/', {'name': 'Futbolka'}, format='json'
        ).data['id']

    def _payload(self, **overrides):
        data = {
            'name': 'Futbolka Classic',
            'category': self.category_id,
            'base_cost_price': '20000',
            'base_selling_price': '35000',
            'description': 'Paxta futbolka',
            'variants': [
                {'color': None, 'size': None, 'stock_quantity': 5},
                {'color': None, 'size': None, 'stock_quantity': 3},
            ],
        }
        data.update(overrides)
        return data

    def test_product_created_with_category_and_no_brand(self):
        """There is no Brand entity in this project - Category is the only classifier."""
        response = self.client.post('/api/products/', self._payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertNotIn('brand', response.data)
        self.assertNotIn('brand', str(response.data).lower())

    def test_barcode_is_generated_when_not_supplied(self):
        response = self.client.post('/api/products/', self._payload(), format='json')
        self.assertTrue(response.data['barcode'])
        for variant in response.data['variants']:
            self.assertTrue(variant['barcode'])

    def test_duplicate_product_barcode_is_rejected(self):
        self.client.post('/api/products/', self._payload(barcode='1234567890128'), format='json')
        response = self.client.post(
            '/api/products/', self._payload(name='Boshqa', barcode='1234567890128'), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('barcode', str(response.data).lower())

    def test_duplicate_variant_barcode_is_rejected(self):
        payload = self._payload()
        payload['variants'] = [
            {'color': None, 'size': None, 'barcode': '9999999999994', 'stock_quantity': 1},
            {'color': None, 'size': None, 'barcode': '9999999999994', 'stock_quantity': 1},
        ]
        response = self.client.post('/api/products/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_by_name(self):
        self.client.post('/api/products/', self._payload(), format='json')
        response = self.client.get('/api/products/search/', {'q': 'classic'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]['product_name'], 'Futbolka Classic')

    def test_search_by_barcode(self):
        created = self.client.post('/api/products/', self._payload(), format='json')
        code = created.data['variants'][0]['barcode']
        response = self.client.get('/api/products/search/', {'q': code})
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['barcode'], code)

    def test_scanner_lookup_by_variant_barcode(self):
        created = self.client.post('/api/products/', self._payload(), format='json')
        code = created.data['variants'][0]['barcode']
        response = self.client.get('/api/products/by_barcode/', {'code': code})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['type'], 'variant')

    def test_scanner_lookup_by_product_barcode(self):
        created = self.client.post('/api/products/', self._payload(), format='json')
        response = self.client.get('/api/products/by_barcode/',
                                   {'code': created.data['barcode']})
        self.assertEqual(response.data['type'], 'product')
        self.assertEqual(len(response.data['variants']), 2)

    def test_unknown_barcode_returns_404(self):
        response = self.client.get('/api/products/by_barcode/', {'code': '0000000000000'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_sees_cost_price(self):
        response = self.client.post('/api/products/', self._payload(), format='json')
        self.assertIn('base_cost_price', response.data)

    def test_manager_does_not_receive_cost_price(self):
        """Requirement: managers must not get purchase prices from the API."""
        self.auth(self.manager)
        product_id = self.client.post('/api/products/', self._payload(), format='json').data['id']
        self.auth(self.owner)
        self.client.patch(f'/api/products/{product_id}/', {'base_cost_price': '21000'}, format='json')

        self.auth(self.manager)
        detail = self.client.get(f'/api/products/{product_id}/')
        self.assertNotIn('base_cost_price', detail.data)
        listing = self.client.get('/api/products/')
        self.assertNotIn('base_cost_price', listing.data['results'][0])
        variants = self.client.get('/api/products/variants/')
        self.assertNotIn('cost_price', variants.data['results'][0])

    def test_product_delete_deactivates_instead_of_removing(self):
        product_id = self.client.post('/api/products/', self._payload(), format='json').data['id']
        self.client.delete(f'/api/products/{product_id}/')
        response = self.client.get(f'/api/products/{product_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_active'])

    def test_low_stock_endpoint(self):
        self.client.post('/api/products/', self._payload(
            variants=[{'color': None, 'size': None, 'stock_quantity': 1,
                       'low_stock_threshold': 5}]
        ), format='json')
        response = self.client.get('/api/products/low_stock/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
