import base64
import os
from flask import Flask, render_template, request, redirect, url_for, abort, send_from_directory, flash, jsonify
from werkzeug.utils import secure_filename
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import login_user, LoginManager, UserMixin, login_required, current_user, logout_user

# Image conversion dependencies and plugins
from PIL import Image
import pillow_avif 

from remove_background import remove_background
from remove_image import remove_image

# initialize flask app
app = Flask(__name__)

# image upload configurations
app.config['MAX_CONTENT_LENGTH'] = 8000000 # 8 MB file limit
app.config['UPLOAD_EXTENSIONS'] = ['.jpg', '.png', '.avif', '.HEIC']
app.config['UPLOAD_PATH'] = UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

#app.config['UPLOAD_PATH'] = '/var/www/somi/uploads/'

# Connect to postgresql, hosted on render.com
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://somi_database_bhz4_user:XmVpgYlrnzIdCFrrwltUx2i9edn8OPRc@dpg-d1ukkqbe5dus73dqmm20-a/somi_database_bhz4' 
# Local Host, uncomment below line for local testing
# app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://somiadmin:sweng2025@localhost/somidb'

# create key for hash
app.config['SECRET_KEY'] = '123'
# initialize SQLAlchemy
db = SQLAlchemy(app)
# initialize bcrypt
bcrypt = Bcrypt(app)
# initialize flask_login
login_manager = LoginManager()
login_manager.init_app(app)

#######################################################################################################

###########################
###   BEGIN POSTGRESQL  ###
###########################

# User
class User(UserMixin, db.Model):
    
    __tablename__='Users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(128), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)

    def __repr__(self):
        return f'<User {self.username}>'

# Outfit
class Outfit(db.Model):
    __tablename__ = 'Outfits'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    slot = db.Column(db.Integer, nullable=False)  # 1-9
    state = db.Column(db.Text, nullable=False)    # JSON string of canvas state
    snapshot = db.Column(db.Text, nullable=True)  # base64 PNG string

    __table_args__ = (
        db.UniqueConstraint('user_id', 'slot', name='unique_user_slot'),
    )

##########################
###   END POSTGRESQL   ###
##########################

def convert_to_jpg(input_path):
     # Open the AVIF image
    with Image.open(input_path) as img:
        # Define the output path, changing the extension to .jpg
        output_path = os.path.splitext(input_path)[0] + '.jpg'
        
        # Convert and save the image as JPG
        img.convert('RGB').save(output_path, 'JPEG')
        print(f"Converted {input_path} to {output_path}")

        remove_image(input_path, output_path)
    
    # Return the path of the converted image
    return output_path

#######################################################################################################

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# validates user submitted password against the hash in the database
def authenticate(username, login_password):
  
    database_hashed_password = User.query.filter_by(username=username).first().password
    return bcrypt.check_password_hash(database_hashed_password, login_password)

#######################################################################################################

###########################
###     BEGIN ROUTES    ###
###########################

#####################################################################
#                              index                                #
#####################################################################

@app.route('/', methods=['GET'])
def index():
    return render_template('login.html')

#####################################################################
#                        user homepage/canvas                       #
#####################################################################

@app.route('/home')
@login_required
def home():
    
    # user id of user currently logged in
    user_id = current_user.id
    # /uploads/<user_id>
    user_directory = os.path.join(app.config['UPLOAD_PATH'], str(user_id))


    if not os.path.exists(user_directory):
        return render_template('home.html', files=[])

    # get all files in user directory 
    files = os.listdir(user_directory)
    #render canvas and all files
    return render_template('home.html', files=files, current_slot=1)

#####################################################################
#                            saved outfits                          #
#####################################################################

@app.route('/saved')
@login_required
def saved():
    user_id = current_user.id
    outfits = Outfit.query.filter_by(user_id=user_id).all()
    # Map slot number to snapshot (or None)
    snapshots = {o.slot: o.snapshot for o in outfits}
    return render_template('saved.html', snapshots=snapshots)

#####################################################################
#                        account registration                       #
#####################################################################

@app.route('/register', methods=['GET', 'POST'])
def register():
    
    # if user is already logged in, redirect to homepage
    if current_user.is_authenticated:
        return redirect(url_for('home'));

    # when the user inputs data
    if request.method == 'POST':
    
        username = request.form['username']
        password = request.form['password']
    
        # handle situation where user already exists 
        if (User.query.filter_by(username=username).first()):
            flash('User already exists.')
            return redirect(url_for('register'))

        # hash the password
        hash = bcrypt.generate_password_hash(password).decode('utf-8')
        
        # add user to database
        user = User(username=username, password=hash)
        db.session.add(user)
        db.session.commit()

        # redirect to login page
        flash('Account created successfully.')
        return redirect(url_for('login'))

    # if GET, load the register page
    return render_template('register.html')

#####################################################################
#                              about                                #
#####################################################################

@app.route('/about', methods=['GET'])
def about():
    return render_template('about.html')

#####################################################################
#                              login                                #
#####################################################################

@app.route('/login', methods=['GET', 'POST'])
def login():
    
    # handle user submitted login credentials
    if request.method == 'POST':
        
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()

        # validate user exists in database and password is correct
        if user and authenticate(username, password):
            login_user(user)
            return redirect(url_for('home'))
    
        # authentication failed, redirect back to login
        flash('Error: incorrect username or password. Please try again.')
        return redirect(url_for('login'))

    # if GET, load login page
    return render_template('login.html')

#####################################################################
#                              logout                               #
#####################################################################

@app.route('/logout', methods=['POST'])
@login_required
def logout():

    # logout and redirect to login page
    logout_user()
    return redirect(url_for('login'))

#####################################################################
#                          image uploads                            #
#####################################################################

@app.route('/upload', methods=['POST'])
@login_required
def upload_files():
   
    # get user id
    user_id = current_user.id
    
    # wait for user to upload file on website
    uploaded_file = request.files['file']
    filename = secure_filename(uploaded_file.filename)

    # if file exists, 
    if filename != '':
        
        # validate file extension
        file_ext = os.path.splitext(filename)[1]
        if file_ext not in app.config['UPLOAD_EXTENSIONS']:
            abort(400)
    
        # uploads/<user_id>/
        usr_upload_directory = (os.path.join(app.config['UPLOAD_PATH'], str(user_id)))
        # make user directoy if it doesn't already exist
        if not os.path.exists(usr_upload_directory):
            os.makedirs(usr_upload_directory)
        
        # uploads/<user_id>/<filename>
        filepath = os.path.join(usr_upload_directory, filename)
        # upload file to user directory
        uploaded_file.save(filepath)
        flash('File uploaded successfully.')

        # Convert AVIF/WEBP to JPG and use the JPG as the displayed file
        if file_ext in [".avif", ".webp"]:
            input_path = filepath
            jpg_path = convert_to_jpg(input_path)
            # Optionally, remove the original file to only keep the JPG
            os.remove(input_path)

    return redirect(url_for('home'))

# New route to serve uploaded images
@app.route('/uploads/<user_id>/<filename>')
@login_required
def uploaded_file(user_id, filename):

    # get user directory
    usr_directory = os.path.join(app.config['UPLOAD_PATH'], str(user_id))

    # prevent unauthorized access to other user's images
    if str(current_user.id) != user_id:
        abort(400)

    # serve the image
    return send_from_directory(usr_directory, filename)

# Delete that jittleyang
@app.route('/delete_image', methods=['POST'])
@login_required
def delete_image():
    data = request.get_json()
    filename = data.get('filename')
    user_id = data.get('user_id', current_user.id)  # fallback to current user

    if not filename:
        return jsonify({'error': 'No filename provided'}), 400

    # Delete file from disk
    file_path = os.path.join(app.config['UPLOAD_PATH'], str(user_id), filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'File not found'}), 404
    
#####################################################################
#                          save outfit                              #   
@app.route('/save_outfit', methods=['POST'])
@login_required
def save_outfit():
    data = request.get_json()
    slot = data.get('slot')
    state = data.get('state')
    snapshot = data.get('snapshot')

    user_id = current_user.id
    user_dir = os.path.join('user_data', str(user_id))
    snapshots_dir = os.path.join(user_dir, 'snapshots')
    os.makedirs(snapshots_dir, exist_ok=True)

    # Save JSON state
    with open(os.path.join(user_dir, f'slot_{slot}.json'), 'w') as f:
        f.write(state)

    # Save PNG image (if provided)
    if snapshot:
        try:
            header, encoded = snapshot.split(',', 1)
            print("Snapshot starts with:", snapshot[:30])
            image_data = base64.b64decode(encoded)
            with open(os.path.join(snapshots_dir, f'slot_{slot}.png'), 'wb') as f:
                f.write(image_data)
        except Exception as e:
            return jsonify(success=False, error=f"Snapshot decode failed: {str(e)}")

    return jsonify(success=True)

@app.route('/load_outfit/<int:slot>', methods=['GET'])
@login_required
def load_outfit(slot):
    outfit = Outfit.query.filter_by(user_id=current_user.id, slot=slot).first()
    if outfit:
        return jsonify({'success': True, 'state': outfit.state})
    else:
        return jsonify({'success': False, 'error': 'No outfit saved in this slot'}), 404


@app.route('/snapshots/<user_id>/<filename>')
def serve_snapshot(user_id, filename):
    return send_from_directory(f"user_data/{user_id}/snapshots", filename)


#####################################################################
#                          remove background                        #
@app.route('/remove_bg', methods=['POST'])
@login_required
def remove_bg():
    data = request.get_json()
    filename = data.get('filename')
    user_id = current_user.id

    if not filename:
        return jsonify({'success': False, 'error': 'No filename provided'}), 400

    usr_upload_directory = os.path.join(app.config['UPLOAD_PATH'], str(user_id))
    input_path = os.path.join(usr_upload_directory, filename)
    output_path = os.path.join(usr_upload_directory, "processed-" + filename)

    try:
        remove_background(input_path, output_path)
        # Optionally, replace the original image with the processed one
        os.replace(output_path, input_path)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

###########################
###      END ROUTES     ###
###########################

#####################################################################

#if __name__ == ("__main__"):
#    app.run(debug=True)
