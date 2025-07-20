import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your_default_secret_key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'postgresql+psycopg://somiadmin:sweng2025@localhost/somidb'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 8000000  # 8 MB file limit
    UPLOAD_EXTENSIONS = ['.jpg', '.png', '.avif', '.HEIC']
    UPLOAD_PATH = '/var/www/somi/uploads/'