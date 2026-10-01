"""Create (or update) the owner account. Idempotent - safe to run on every start."""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.authentication.models import User


class Command(BaseCommand):
    help = 'Create or update the owner account (used on startup in Docker).'

    def add_arguments(self, parser):
        parser.add_argument('--username', default='admin')
        parser.add_argument('--password', default='1')
        parser.add_argument('--pin', default='0808', help='Owner login PIN')
        parser.add_argument('--email', default='admin@brandx.local')

    @transaction.atomic
    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        pin = options['pin']
        email = options['email']

        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email},
        )
        user.email = email
        user.role = User.ROLE_OWNER
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save()
        if pin:
            user.set_pin(pin)
            user.save(update_fields=['pin_hash', 'updated_at'])

        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(
            f'{action} owner "{username}" (password and PIN set).'
        ))
