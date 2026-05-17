"""Authentication App Models - Custom User with Role-Based Access"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Extended User model with role-based access control.
    Roles: admin (full access), manager (operational), guest (read/basic POS)
    """
    ROLE_ADMIN = 'admin'
    ROLE_MANAGER = 'manager'
    ROLE_GUEST = 'guest'

    ROLE_CHOICES = [
        (ROLE_ADMIN, 'Admin'),
        (ROLE_MANAGER, 'Manager'),
        (ROLE_GUEST, 'Guest'),
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_GUEST)
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'

    @property
    def is_admin(self):
        return self.role == self.ROLE_ADMIN

    @property
    def is_manager(self):
        return self.role in [self.ROLE_ADMIN, self.ROLE_MANAGER]
