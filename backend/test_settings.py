#!/usr/bin/env python3
"""Test if settings load correctly"""

from app.settings import settings

print('✓ Settings loaded:', settings.APP_NAME)
print('✓ Has greeting_menus:', hasattr(settings, 'ROUTEMOBILE_TEMPLATE_greeting_menus'))
print('✓ Value:', settings.ROUTEMOBILE_TEMPLATE_greeting_menus)
print('\n✓ All settings loaded successfully!')
