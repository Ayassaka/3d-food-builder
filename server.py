#!/usr/bin/python
import time
import os
from flask import Flask, request, send_from_directory

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['STATIC_FOLDER'] = 'dist'

@app.route('/', methods=['GET'])
def index():
    return serve_statics('index.html')

@app.route('/builder/<path:path>', methods=['GET'])
def serve_statics(path):
    return send_from_directory(app.config['STATIC_FOLDER'], path)

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        file = request.files['file']
        filename = time.strftime('%Y%m%d-%H%M%S.stl', time.localtime(time.time()))
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        return 'OK', 200
    except:
        return 'Error', 500

if __name__ == "__main__":
    app.run(host='0.0.0.0')