import gzip
import os
import magic

from io import BytesIO as IO
from django.http import HttpResponse
from django.conf import settings


def zip_response(json_data):
    gzip_buffer = IO()
    gzip_file = gzip.GzipFile(mode='w', compresslevel=6, fileobj=gzip_buffer)
    gzip_file.write(json_data)
    gzip_file.close()

    response = HttpResponse(gzip_buffer.getvalue())
    response['Content-Encoding'] = 'gzip'
    response['Vary'] = 'Accept-Encoding'
    response['Content-Type'] = 'application/json'
    response['Content-Length'] = len(gzip_buffer.getvalue())

    return response


def get_manuals():
    """
    Return the manuals , files to be downloaded as a list
    :return:
    A list of files to be downloaded
    """
    manuals = []
    manuals_directory = settings.MEDIA_ROOT + '/manuals/'
    for file_name in os.listdir(manuals_directory):
        file_path = manuals_directory + file_name
        file_info = {
            'file_name': file_name,
            'mime': get_type_of_file(file_path)
        }
        manuals.append(file_info)

    return manuals


def get_type_of_file(file_path):
    """
    Given a file get its mime type.
    :param file_path:
    :return: Mime type as a string
    """
    mime = magic.Magic(mime=True)
    try:
        file_mime = mime.from_file(file_path)
        return file_mime
    except Exception:
        print("Could not get the MIME TYPE")


def show_profile_image_everywhere(request):
    thumb_url = 'none'
    try:
        if request.user.is_authenticated:
            thumb_url = request.user.profile.photo['gravatar'].url
    except Exception as e:
        print((str(e)))
        thumb_url = 'static/img/user.png'

    return {'thumb_url': thumb_url}


def avail_request_object(request):
    """
    DUe to the guardian redirection to 403.html page there is need to
    pass the request object globally.
    :param request:
    :return:
    """
    return {'request': request}
