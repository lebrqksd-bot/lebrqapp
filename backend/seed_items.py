#!/usr/bin/env python3
"""
Seed sample catalog items (cakes, food & beverages, performing team) for Grant Hall (space_id=1).

Run:
  C:/Users/HP/Desktop/LebrqApp/.venv/Scripts/python.exe C:/Users/HP/Desktop/LebrqApp/backend/seed_items.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import settings


SAMPLE_ITEMS = [
    # Cakes (everyday & celebration + specials)
    {"category": "cake", "subcategory": None, "type": None, "name": "Black Forest", "description": "Classic chocolate cake with cherries", "price": 800, "image_url": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "White Forest", "description": "Vanilla cake with white chocolate", "price": 750, "image_url": "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Chocolate Truffle", "description": "Rich chocolate truffle cake", "price": 900, "image_url": "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Dutch Truffle", "description": "Premium Dutch chocolate truffle", "price": 950, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Red Velvet", "description": "Classic red velvet with cream cheese", "price": 700, "image_url": "https://images.unsplash.com/photo-1616690710400-a16d146927c5?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Blueberry", "description": "Fresh blueberry cake", "price": 650, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Butterscotch", "description": "Rich butterscotch flavor", "price": 600, "image_url": "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Pineapple", "description": "Tropical pineapple cake", "price": 550, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Fresh Fruit Gateau", "description": "Mixed fruit gateau", "price": 800, "image_url": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Kerala Plum Cake (with eggs)", "description": "Traditional Kerala plum cake with eggs", "price": 1000, "image_url": "https://images.unsplash.com/photo-1563379091339-03246963d4d0?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Kerala Plum Cake (without eggs)", "description": "Traditional Kerala plum cake without eggs", "price": 950, "image_url": "https://images.unsplash.com/photo-1563379091339-03246963d4d0?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Pinata Cake", "description": "Surprise-filled pinata cake", "price": 1200, "image_url": "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Bento Cake", "description": "Japanese-style bento cake", "price": 800, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Photo Cake", "description": "Custom photo printed cake", "price": 1000, "image_url": "https://images.unsplash.com/photo-1616690710400-a16d146927c5?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Theme Cake (Kids)", "description": "Custom theme cake for kids", "price": 1100, "image_url": "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Theme Cake (Adults)", "description": "Custom theme cake for adults", "price": 1200, "image_url": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=60&auto=format&fit=crop"},
    {"category": "cake", "subcategory": None, "type": None, "name": "Cupcakes & Minis", "description": "Assorted cupcakes and mini cakes", "price": 300, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},

    # Breakfast - Vegetarian
    {"category": "food", "subcategory": "breakfast", "type": "veg", "name": "Puttu & Kadala Curry", "description": "Steamed rice cake with chickpea curry", "price": 80, "image_url": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "breakfast", "type": "veg", "name": "Appam & Veg Stew", "description": "Rice pancakes with vegetable stew", "price": 90, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "breakfast", "type": "veg", "name": "Idiyappam & Veg Kurma", "description": "String hoppers with vegetable kurma", "price": 85, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "breakfast", "type": "veg", "name": "Uppumavu (Upma)", "description": "Semolina with vegetables", "price": 40, "image_url": "https://images.unsplash.com/photo-1563379091339-03246963d4d0?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "breakfast", "type": "veg", "name": "Vegetable Uthappam", "description": "Thick dosa with mixed vegetables", "price": 70, "image_url": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "breakfast", "type": "veg", "name": "Masala Dosa", "description": "Crispy dosa with spiced potato filling", "price": 80, "image_url": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=60&auto=format&fit=crop"},

    # Breakfast - Non-Vegetarian
    {"category": "food", "subcategory": "breakfast", "type": "non-veg", "name": "Mutta Roast with Appam", "description": "Spicy tomato-onion egg masala with appam", "price": 120, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "breakfast", "type": "non-veg", "name": "Egg Curry with Appam", "description": "Coconut-milk gravy with rice pancakes", "price": 110, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "breakfast", "type": "non-veg", "name": "Erachi Puttu (Chicken/Beef)", "description": "Layered puttu with meat masala", "price": 150, "image_url": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "breakfast", "type": "non-veg", "name": "Fish Molee with Appam", "description": "Mild coconut-milk fish curry", "price": 140, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "breakfast", "type": "non-veg", "name": "Chicken Stew with Appam", "description": "Peppery coconut-milk stew", "price": 130, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "breakfast", "type": "non-veg", "name": "Chicken Pathiri / Irachi Pathiri", "description": "Malabar style meat pathiri", "price": 160, "image_url": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&q=60&auto=format&fit=crop"},

    # Lunch
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Kerala Chicken Biryani", "description": "Malabar/Thalassery style biryani", "price": 200, "image_url": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Butter Chicken", "description": "Creamy tomato chicken curry", "price": 180, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Chicken Tikka Masala", "description": "Tandoori chicken in creamy sauce", "price": 190, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "veg", "name": "Paneer Butter Masala", "description": "Cottage cheese in creamy tomato gravy", "price": 160, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Mutton Biryani", "description": "Fragrant rice with mutton", "price": 220, "image_url": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Fish Biryani", "description": "Fragrant rice with fish", "price": 200, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "veg", "name": "Ghee Rice", "description": "Aromatic basmati rice with ghee", "price": 100, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "veg", "name": "Veg Fried Rice", "description": "Mixed vegetable fried rice", "price": 120, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Egg Fried Rice", "description": "Fried rice with scrambled eggs", "price": 130, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Chicken Fried Rice", "description": "Fried rice with chicken pieces", "price": 150, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Chicken 65", "description": "Spicy deep-fried chicken", "price": 180, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Chicken Dry Fry", "description": "Crispy dry chicken preparation", "price": 170, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Pepper Chicken", "description": "Spicy pepper chicken curry", "price": 190, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Chilli Chicken", "description": "Indo-Chinese chilli chicken", "price": 180, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Chicken Tikka", "description": "Tandoori grilled chicken", "price": 200, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Crispy Fried Chicken Strips", "description": "Breaded chicken strips", "price": 160, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Chicken Cutlet", "description": "Spiced chicken cutlets", "price": 140, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "lunch", "type": "non-veg", "name": "Chicken Lollipop", "description": "Drumstick chicken lollipops", "price": 150, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},

    # Fish & Seafood
    {"category": "food", "subcategory": "fish-seafood", "type": "non-veg", "name": "Meen Pollichathu", "description": "Kerala style fish wrapped in banana leaf", "price": 220, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "fish-seafood", "type": "non-veg", "name": "Prawn Tempura", "description": "Crispy fried prawns", "price": 250, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "fish-seafood", "type": "non-veg", "name": "Prawn Roast", "description": "Spicy roasted prawns", "price": 240, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "fish-seafood", "type": "non-veg", "name": "Tawa Fish Fry", "description": "Pan-fried fish with spices", "price": 200, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "fish-seafood", "type": "non-veg", "name": "Kerala Spiced Fry", "description": "Traditional Kerala fish fry", "price": 190, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},

    # Mutton & Beef
    {"category": "food", "subcategory": "mutton-beef", "type": "non-veg", "name": "Mutton Chilli Fry", "description": "Spicy mutton with chillies", "price": 250, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "mutton-beef", "type": "non-veg", "name": "Pepper Mutton", "description": "Peppery mutton curry", "price": 240, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "mutton-beef", "type": "non-veg", "name": "Beef Ularthiyathu", "description": "Kerala style beef fry", "price": 230, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "mutton-beef", "type": "non-veg", "name": "Dry Fry (Malabar style)", "description": "Malabar style dry beef fry", "price": 220, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},

    # Dinner
    {"category": "food", "subcategory": "dinner", "type": "veg", "name": "Kerala Parotta", "description": "Layered flatbread", "price": 30, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "dinner", "type": "veg", "name": "Chapati / Phulka", "description": "Whole wheat flatbread", "price": 25, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "dinner", "type": "veg", "name": "Butter Naan", "description": "Leavened bread with butter", "price": 40, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "dinner", "type": "veg", "name": "Garlic Naan", "description": "Naan bread with garlic", "price": 45, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "dinner", "type": "veg", "name": "Poori", "description": "Deep-fried bread", "price": 35, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},

    # Desserts
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Ada Pradhaman", "description": "Rice pasta pudding with jaggery", "price": 80, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Palada Payasam", "description": "Rice flakes pudding with milk", "price": 70, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Parippu Payasam", "description": "Lentil pudding", "price": 60, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Fruit Custard", "description": "Mixed fruit custard", "price": 50, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Gulab Jamun", "description": "Milk dumplings in sugar syrup", "price": 40, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Brownie", "description": "Chocolate brownie", "price": 60, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Pudding", "description": "Vanilla pudding", "price": 45, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    # Ice cream options
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Vanilla Bean Ice Cream", "description": "Classic vanilla ice cream", "price": 50, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Chocolate Ice Cream", "description": "Rich chocolate ice cream", "price": 55, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Strawberry Ice Cream", "description": "Fresh strawberry ice cream", "price": 50, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Butterscotch Ice Cream", "description": "Creamy butterscotch ice cream", "price": 55, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Coffee Ice Cream", "description": "Coffee flavored ice cream", "price": 50, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Pistachio Ice Cream", "description": "Nutty pistachio ice cream", "price": 60, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Caramel Ice Cream", "description": "Sweet caramel ice cream", "price": 55, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Tender Coconut Ice Cream", "description": "Coconut flavored ice cream", "price": 50, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Jackfruit Ice Cream", "description": "Tropical jackfruit ice cream", "price": 60, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Nadan Mango Ice Cream", "description": "Traditional mango ice cream", "price": 55, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Kulfi (Malai)", "description": "Traditional milk kulfi", "price": 40, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Kulfi (Pista)", "description": "Pistachio kulfi", "price": 45, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Kulfi (Kesar)", "description": "Saffron kulfi", "price": 50, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Falooda Set", "description": "Traditional falooda dessert", "price": 80, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Sizzling Brownie with Ice Cream", "description": "Hot brownie with ice cream", "price": 120, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Live Waffle Sundae", "description": "Fresh waffle with ice cream", "price": 100, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Crepe & Ice Cream", "description": "French crepe with ice cream", "price": 90, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "desserts", "type": "veg", "name": "Rolled Ice Cream", "description": "Thai rolled ice cream", "price": 70, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=60&auto=format&fit=crop"},

    # Beverages
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Watermelon Juice", "description": "Fresh watermelon juice", "price": 50, "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Pineapple Juice", "description": "Fresh pineapple juice", "price": 45, "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Orange Juice", "description": "Fresh orange juice", "price": 40, "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Tender Coconut Water", "description": "Fresh coconut water", "price": 35, "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Lemon-Mint Cooler", "description": "Refreshing lemon mint drink", "price": 30, "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Nannari Sarbath", "description": "Traditional herbal drink", "price": 25, "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Kerala Black Tea (Sulaimani)", "description": "Traditional Kerala black tea", "price": 20, "image_url": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Masala Chai", "description": "Spiced Indian tea", "price": 25, "image_url": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Ginger-Lemon Tea", "description": "Herbal tea without milk", "price": 20, "image_url": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Filter Coffee", "description": "South Indian filter coffee", "price": 30, "image_url": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Milk Coffee", "description": "Coffee with milk", "price": 25, "image_url": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "beverages", "type": "veg", "name": "Iced Coffee", "description": "Chilled coffee drink", "price": 35, "image_url": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=60&auto=format&fit=crop"},

    # Snacks (finger foods)
    {"category": "food", "subcategory": "snacks", "type": "non-veg", "name": "Chicken Cutlet", "description": "Spiced chicken cutlets", "price": 80, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "snacks", "type": "non-veg", "name": "Chicken Nuggets", "description": "Breaded chicken pieces", "price": 90, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "snacks", "type": "non-veg", "name": "Mini Chicken Samosa", "description": "Small chicken samosas", "price": 60, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "snacks", "type": "veg", "name": "Spring Roll", "description": "Crispy spring rolls", "price": 50, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "snacks", "type": "non-veg", "name": "Egg Puff", "description": "Flaky pastry with egg filling", "price": 40, "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "snacks", "type": "veg", "name": "Veg Puff", "description": "Flaky pastry with vegetable filling", "price": 35, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "snacks", "type": "veg", "name": "Pazhampozhi", "description": "Ripe banana fritters", "price": 30, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "snacks", "type": "non-veg", "name": "Chicken Samosa", "description": "Spiced chicken samosas", "price": 50, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "snacks", "type": "non-veg", "name": "Chicken Roll", "description": "Chicken wrapped in paratha", "price": 70, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "snacks", "type": "veg", "name": "Unniyappam", "description": "Sweet rice fritters", "price": 25, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "snacks", "type": "veg", "name": "Fruit Bowl Cups", "description": "Mixed fruit cups", "price": 40, "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=60&auto=format&fit=crop"},
    {"category": "food", "subcategory": "snacks", "type": "veg", "name": "Momos", "description": "Steamed dumplings", "price": 60, "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=60&auto=format&fit=crop"},

    # Performing Teams
    {"category": "team", "subcategory": None, "type": None, "name": "DJ Team", "description": "Professional DJ services", "price": 2000, "image_url": "/static/ganamela.jpg"},
    {"category": "team", "subcategory": None, "type": None, "name": "Live Band", "description": "Live music performance", "price": 5000, "image_url": "/static/ganamela.jpg"},
    {"category": "team", "subcategory": None, "type": None, "name": "Dance Group", "description": "Professional dance performance", "price": 3000, "image_url": "/static/ganamela.jpg"},
]


async def seed(space_id: int = 1):
    url = settings.DATABASE_URL
    engine = create_async_engine(url, echo=True)
    async with engine.begin() as conn:
        # Ensure items table exists
        # Insert items if a (name, space_id) pair does not already exist
        for it in SAMPLE_ITEMS:
            params = {
                "vendor_id": None,
                "category": it["category"],
                "subcategory": it["subcategory"],
                "type": it["type"],
                "name": it["name"],
                "description": it.get("description"),
                "price": float(it["price"]),
                "image_url": it.get("image_url"),
                "space_id": space_id,
                "available": 1,
            }
            # Skip if exists
            exists = await conn.execute(text("SELECT id FROM items WHERE name=:name AND (space_id=:space_id OR space_id IS NULL) LIMIT 1"), {"name": params["name"], "space_id": space_id})
            if exists.first():
                print(f"Skip existing: {params['name']}")
                continue
            await conn.execute(text(
                """
                INSERT INTO items (vendor_id, category, subcategory, type, name, description, price, image_url, space_id, available, created_at)
                VALUES (:vendor_id, :category, :subcategory, :type, :name, :description, :price, :image_url, :space_id, :available, NOW())
                """
            ), params)
        print("✓ Seeded sample items")


if __name__ == "__main__":
    asyncio.run(seed())
