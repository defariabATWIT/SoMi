import http.client
import mimetypes
import os
import uuid

# Please replace with your own apiKey
apiKey = 'sandbox_c9a95736039eb402b1a3ee516762b99cbc91c42e'

def remove_background(input_image_path, output_image_path):
    # Define multipart boundary
    boundary = '----------{}'.format(uuid.uuid4().hex)

    # Get mimetype of image
    content_type, _ = mimetypes.guess_type(input_image_path)
    if content_type is None:
        content_type = 'application/octet-stream'  # Default type if guessing fails

    # Prepare the POST data
    with open(input_image_path, 'rb') as f:
        image_data = f.read()
    filename = os.path.basename(input_image_path)

    body = (
    f"--{boundary}\r\n"
    f"Content-Disposition: form-data; name=\"image_file\"; filename=\"{filename}\"\r\n"
    f"Content-Type: {content_type}\r\n\r\n"
    ).encode('utf-8') + image_data + f"\r\n--{boundary}--\r\n".encode('utf-8')
    
    # Set up the HTTP connection and headers
    conn = http.client.HTTPSConnection('sdk.photoroom.com')

    headers = {
        'Content-Type': f'multipart/form-data; boundary={boundary}',
        'x-api-key': apiKey
    }

    # Make the POST request
    conn.request('POST', '/v1/segment', body=body, headers=headers)
    response = conn.getresponse()

    # Handle the response
    if response.status == 200:
        response_data = response.read()
        with open(output_image_path, 'wb') as out_f:
            out_f.write(response_data)
        print("Image saved to", output_image_path)
    else:
        print(f"Error: {response.status} - {response.reason}")
        print(response.read())

    # Close the connection
    conn.close()