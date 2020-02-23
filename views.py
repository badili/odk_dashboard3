  # Python 2 only


import json
import logging
import traceback
import gzip

try:
    from io import StringIO as IO
except ImportError:
    from io import StringIO as IO

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http.response import HttpResponse
from django.shortcuts import render, redirect
from django.middleware import csrf

from wsgiref.util import FileWrapper

from vendor.odk_parser import OdkParser
from vendor.terminal_output import Terminal
from vendor.models import ODKForm, FormViews, Profile

import os
terminal = Terminal()


def login_page(request, *args, **kwargs):
    csrf_token = get_or_create_csrf_token(request)
    page_settings = {'page_title': "%s | Login Page" % settings.SITE_NAME, 'csrf_token': csrf_token}
    print('\nLogin attempt')
    print(kwargs)
    print(args)
    # terminal.tprint(csrf_token, 'ok')

    try:
        username = request.POST['username']
        password = request.POST['pass']

        if username is not None:
            user = authenticate(username=username, password=password)

            if user is None:
                terminal.tprint("Couldn't authenticate the user... redirect to login page", 'fail')
                page_settings['error'] = settings.SITE_NAME + " could not authenticate you. You entered an invalid username or password"
                return render(request, 'login.html', page_settings)
            else:
                terminal.tprint('All ok', 'debug')
                login(request, user)
                return redirect('/dashboard', request=request)
        else:
            return render(request, 'login.html')
    except KeyError as e:
        # ask the user to enter the username and/or password
        terminal.tprint('\nUsername/password not defined: %s' % str(e), 'warn')
        page_settings['message'] = "Please enter your username and password"
        return render(request, 'login.html', page_settings)
    except Profile.DoesNotExist as e:
        terminal.tprint(str(e), 'fail')
        # The user doesn't have a user profile, lets create a minimal one
        profile = Profile(
            user=user
        )
        profile.save()
        return render(request, 'login.html', page_settings)
    except Exception as e:
        terminal.tprint(csrf_token, 'ok')
        terminal.tprint(str(e), 'fail')
        page_settings['error'] = "There was an error while authenticating.<br />Please try again and if the error persist, please contact the system administrator"
        return render(request, 'login.html', page_settings)


def user_logout(request):
    logout(request)
    # specifically clear this session variable
    print(request.session.session_key)
    for key in request.session.keys():
        print(key)
    if 'cur_user' in request.session:
        del request.session['cur_user']
    return redirect('/', request=request)


def under_review_page(request):
    return render(request, 'under_review.html')


def landing_page(request):
    get_or_create_csrf_token(request)
    # return render(request, 'landing_page.html')
    return render(request, 'azizi_amp.html')


# @login_required(login_url='/login')
def download_page(request):
    csrf_token = get_or_create_csrf_token(request)

    # get all the data to be used to construct the tree
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    all_forms = parser.get_all_forms()
    page_settings = {
        'page_title': "%s | Downloads" % settings.SITE_NAME,
        'csrf_token': csrf_token,
        'section_title': 'Download Section',
        'site_name': settings.SITE_NAME,
        'all_forms': json.dumps(all_forms)
    }
    return render(request, 'download.html', page_settings)


# @login_required(login_url='/login')
def modify_view(request):

    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    if (request.get_full_path() == '/edit_view/'):
        response = parser.edit_view(request)
    elif (request.get_full_path() == '/delete_view/'):
        response = parser.delete_view(request)

    return HttpResponse(json.dumps(response))


# @login_required(login_url='/login')
def manage_views(request):
    csrf_token = get_or_create_csrf_token(request)

    # get all the data to be used to construct the tree
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    all_data = parser.get_views_info()

    page_settings = {
        'page_title': "%s | Manage Generated Views" % settings.SITE_NAME,
        'csrf_token': csrf_token,
        'section_title': 'Manage Views',
        'site_name': settings.SITE_NAME,
        'all_data': json.dumps(all_data)
    }
    return render(request, 'manage_views.html', page_settings)


# @login_required(login_url='/login')
def update_db(request):
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    try:
        parser.update_sdss_db()
    except Exception as e:
        logging.error(traceback.format_exc())
        print(str(e))
        return HttpResponse(traceback.format_exc())

    return HttpResponse(json.dumps({'error': False, 'message': 'Database updated'}))


# @login_required(login_url='/login')
def form_structure(request):
    # given a form id, get the structure for the form
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    try:
        form_id = int(request.POST['form_id'])
        if form_id == -1:
            return HttpResponse(json.dumps({'error': True, 'message': 'Please select a form to get the structure from'}))
        structure = parser.get_form_structure_as_json(form_id)
    except KeyError as e:
        logging.error(traceback.format_exc())
        return HttpResponse(json.dumps({'error': True, 'message': str(e)}))
    except Exception as e:
        logging.info(str(e))
        logging.debug(traceback.format_exc())
        return HttpResponse(json.dumps({'error': True, 'message': str(e)}))

    return HttpResponse(json.dumps({'error': False, 'structure': structure}))


# @login_required(login_url='/login')
def download_data(request):
    # given the nodes, download the associated data
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    try:
        data = json.loads(request.body)
        # form_id, nodes, d_format, download_type, view_name, uuids=None, update_local_data=True, is_dry_run=True
        # data['filter'] = {}
        res = parser.fetch_merge_data(data['form_id'], data['nodes[]'], data['format'], data['action'], data['view_name'], None, True, settings.IS_DRY_RUN, data['filter_by'])
    except KeyError as e:
        terminal.tprint(traceback.format_exc(), 'fail')
        terminal.tprint(str(e), 'fail')
        response = HttpResponse(json.dumps({'error': True, 'message': str(e)}), content_type='text/json')
        response['Content-Message'] = json.dumps({'error': True, 'message': str(e)})
        return response
    except Exception as e:
        logging.debug(traceback.format_exc())
        logging.error(str(e))
        response = HttpResponse(json.dumps({'error': True, 'message': str(e)}), content_type='text/json')
        response['Content-Message'] = json.dumps({'error': True, 'message': str(e)})
        return response

    if res['is_downloadable'] is True:
        filename = res['filename']
        excel_file = open(filename, 'rb')
        
        response = HttpResponse(excel_file.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename=%s' % os.path.basename(filename)
        response['Content-Length'] = os.path.getsize(filename)
        os.remove(filename)
    else:
        response = HttpResponse(json.dumps({'error': False, 'message': res['message']}), content_type='text/json')
        response['Content-Message'] = json.dumps({'error': False, 'message': res['message']})

    return response


# @login_required(login_url='/login')
def download(request):
    # given the nodes, download the associated data
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    try:
        data = json.loads(request.body)
        filename = parser.fetch_data(data['form_id'], data['nodes[]'], data['format'])
    except KeyError:
        return HttpResponse(traceback.format_exc())
    except Exception as e:
        print(str(e))
        logging.error(traceback.format_exc())

    wrapper = FileWrapper(open(filename))
    response = HttpResponse(wrapper, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename=%s' % os.path.basename(filename)
    response['Content-Length'] = os.path.getsize(filename)

    return response


# @login_required(login_url='/login')
def refresh_forms(request):
    """
    Refresh the database with any new forms
    """
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)


    try:
        all_forms = parser.refresh_forms()
    except Exception:
        logging.error(traceback.format_exc())

    return HttpResponse(json.dumps({'error': False, 'all_forms': all_forms}))


def get_or_create_csrf_token(request):
    token = request.META.get('CSRF_COOKIE', None)
    if token is None:
        print('Getting a new token')
        token = csrf._get_new_csrf_string()
        request.META['CSRF_COOKIE'] = token
    else:
        print('using an old token')

    request.META['CSRF_COOKIE_USED'] = True
    return token


def manage_mappings(request):
    csrf_token = get_or_create_csrf_token(request)

    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    all_forms = parser.get_all_forms()
    (db_tables, tables_columns) = parser.get_db_tables()
    mappings = parser.mapping_info()

    page_settings = {
        'page_title': "%s | Home" % settings.SITE_NAME,
        'csrf_token': csrf_token,
        'section_title': 'Manage ODK and Database Mappings',
        'db_tables': json.dumps(db_tables),
        'tables_columns': json.dumps(tables_columns),
        'all_forms': json.dumps(all_forms),
        'site_name': settings.SITE_NAME,
        'mappings': json.dumps(mappings)
    }
    return render(request, 'manage_mappings.html', page_settings)


def edit_mapping(request):
    parser = OdkParser()
    if (request.get_full_path() == '/edit_mapping/'):
        response = parser.edit_mapping(request)

    return HttpResponse(json.dumps(response))


def create_mapping(request):
    parser = OdkParser()
    mappings = parser.save_mapping(request)
    return return_json(mappings)


def delete_mapping(request):
    parser = OdkParser()
    mappings = parser.delete_mapping(request)
    return return_json(mappings)


def clear_mappings(request):
    parser = OdkParser()
    mappings = parser.clear_mappings()
    return return_json(mappings)


def return_json(mappings):
    to_return = json.dumps(mappings)
    response = HttpResponse(to_return, content_type='text/json')
    response['Content-Message'] = to_return
    return response


def return_polygons(mappings):
    to_return = json.dumps(mappings)
    response = HttpResponse(to_return)
    response['Content-Type'] = 'application/json'
    response['Content-Message'] = to_return
    return response


def validate_mappings(request):
    parser = OdkParser()
    (is_fully_mapped, is_mapping_valid, comments) = parser.validate_mappings()

    to_return = {'error': False, 'is_fully_mapped': is_fully_mapped, 'is_mapping_valid': is_mapping_valid, 'comments': comments}
    return return_json(to_return)


def manual_data_process(request):
    parser = OdkParser()
    is_dry_run = json.loads(request.POST['is_dry_run'])
    (is_success, comments) = parser.manual_process_data(is_dry_run)

    to_return = {'error': is_success, 'comments': comments}
    return return_json(to_return)


def delete_processed_data(request):
    parser = OdkParser()
    (is_success, comments) = parser.delete_processed_data()

    to_return = {'error': is_success, 'comments': comments}
    return return_json(to_return)


def processing_errors(request):
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    csrf_token = get_or_create_csrf_token(request)
    page_settings = {
        'page_title': "%s | Processing Errors" % settings.SITE_NAME,
        'csrf_token': csrf_token,
        'site_name': settings.SITE_NAME,
        'section_title': 'Processing Errors'
    }
    return render(request, 'processing_errors.html', page_settings)


def fetch_processing_errors(request):
    cur_page = json.loads(request.GET['page'])
    per_page = json.loads(request.GET['perPage'])
    offset = json.loads(request.GET['offset'])
    sorts = json.loads(request.GET['sorts']) if 'sorts' in request.GET else None
    queries = json.loads(request.GET['queries']) if 'queries' in request.GET else None

    parser = OdkParser()
    (is_success, proc_errors) = parser.processing_errors(cur_page, per_page, offset, sorts, queries)
    to_return = json.dumps(proc_errors)

    response = HttpResponse(to_return, content_type='text/json')
    response['Content-Message'] = to_return
    return response


def fetch_single_error(request):
    err_id = json.loads(request.POST['err_id'])
    parser = OdkParser()
    (is_success, cur_error, r_sub) = parser.fetch_single_error(err_id)

    to_return = {'error': is_success, 'err_json': cur_error, 'raw_submission': r_sub}
    return return_json(to_return)


def map_visualization(request):
    csrf_token = get_or_create_csrf_token(request)
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    map_settings = parser.fetch_base_map_settings()
    page_settings = {
        'page_title': "%s | Map Based Visualizations" % settings.SITE_NAME,
        'csrf_token': csrf_token,
        'map_title': 'Map Based Visualization',
        'section_title': 'Map Based Visualization',
        'map_settings': json.dumps(map_settings)
    }
    return render(request, 'map_visualizations.html', page_settings)


def first_level_geojson(request):
    parser = OdkParser()
    c_code = json.loads(request.GET['c_code'])
    cur_polygons = parser.first_level_geojson(int(c_code))

    return HttpResponse(json.dumps(cur_polygons), content_type='application/json')


def save_json_edits(request):
    err_id = json.loads(request.POST['err_id'])
    parser = OdkParser()
    (is_error, cur_error) = parser.save_json_edits(err_id, json.loads(request.POST['json_data']))

    to_return = {'error': is_error, 'message': cur_error}
    return return_json(to_return)


def process_single_submission(request):
    err_id = json.loads(request.POST['err_id'])
    parser = OdkParser()
    (is_error, cur_error) = parser.process_single_submission(err_id)

    to_return = {'error': is_error, 'message': cur_error}
    return return_json(to_return)


def processing_status(request):
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    csrf_token = get_or_create_csrf_token(request)
    page_settings = {
        'page_title': "%s | Processing Status" % settings.SITE_NAME,
        'csrf_token': csrf_token,
        'site_name': settings.SITE_NAME,
        'section_title': 'Processing Status'
    }
    return render(request, 'processing_status.html', page_settings)


def fetch_processing_status(request):
    cur_page = json.loads(request.GET['page'])
    per_page = json.loads(request.GET['perPage'])
    offset = json.loads(request.GET['offset'])
    sorts = json.loads(request.GET['sorts']) if 'sorts' in request.GET else None
    queries = json.loads(request.GET['queries']) if 'queries' in request.GET else None

    parser = OdkParser()
    (is_success, proc_errors) = parser.fetch_processing_status(cur_page, per_page, offset, sorts, queries)
    to_return = json.dumps(proc_errors)

    response = HttpResponse(to_return, content_type='text/json')
    response['Content-Message'] = to_return
    return response


def system_settings(request):
    csrf_token = get_or_create_csrf_token(request)

    parser = OdkParser()
    all_settings = parser.get_all_settings()

    page_settings = {
        'page_title': "%s | Home" % settings.SITE_NAME,
        'csrf_token': csrf_token,
        'settings': all_settings,
        'site_name': settings.SITE_NAME,
        'section_title': 'Manage %s Settings' % settings.SITE_NAME
    }
    return render(request, 'system_settings.html', page_settings)


def save_settings(request):
    # saves the settings as pased from the front end
    csrf_token = get_or_create_csrf_token(request)

    parser = OdkParser()
    result = parser.save_settings(request)

    return return_json(result)


def forms_settings(request):
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    are_ona_settings_saved = parser.are_ona_settings_saved()
    if is_first_login is True or are_ona_settings_saved is False:
        return system_settings(request)

    csrf_token = get_or_create_csrf_token(request)

    page_settings = {
        'page_title': "%s | Home" % settings.SITE_NAME,
        'csrf_token': csrf_token,
        'site_name': settings.SITE_NAME,
        'section_title': 'Manage %s Forms' % settings.SITE_NAME
    }
    return render(request, 'forms_settings.html', page_settings)


def forms_settings_info(request):
    cur_page = json.loads(request.GET['page'])
    per_page = json.loads(request.GET['perPage'])
    offset = json.loads(request.GET['offset'])
    sorts = json.loads(request.GET['sorts']) if 'sorts' in request.GET else None
    queries = json.loads(request.GET['queries']) if 'queries' in request.GET else None

    parser = OdkParser()
    (is_success, proc_errors) = parser.get_odk_forms_info(cur_page, per_page, offset, sorts, queries)
    to_return = json.dumps(proc_errors)

    response = HttpResponse(to_return, content_type='text/json')
    response['Content-Message'] = to_return
    return response


def fetch_form_details(request):
    form_id = json.loads(request.POST['form_id'])
    parser = OdkParser()
    (is_error, cur_form) = parser.fetch_form_details(form_id)
    (is_error1, all_groups) = parser.fetch_form_groups()

    if is_error is True or is_error1 is True:
        return return_json({'error': True, 'message': 'There was an error while fetching data from the database.'})

    to_return = {'error': False, 'form_details': cur_form, 'form_groups': all_groups}
    return return_json(to_return)


def save_form_details(request):
    parser = OdkParser()
    (is_error, cur_form) = parser.save_form_details(request)

    if is_error is True:
        return return_json({'error': True, 'message': 'There was an error while fetching data from the database.'})

    (is_success, form_settings) = parser.get_odk_forms_info(1, 10, 0, None, None)

    return return_json({'error': False, 'form_settings': form_settings})


def form_groups_info(request):
    cur_page = json.loads(request.GET['page'])
    per_page = json.loads(request.GET['perPage'])
    offset = json.loads(request.GET['offset'])
    sorts = json.loads(request.GET['sorts']) if 'sorts' in request.GET else None
    queries = json.loads(request.GET['queries']) if 'queries' in request.GET else None

    parser = OdkParser()
    (is_success, proc_errors) = parser.get_form_groups_info(cur_page, per_page, offset, sorts, queries)
    to_return = json.dumps(proc_errors)

    response = HttpResponse(to_return, content_type='text/json')
    response['Content-Message'] = to_return
    return response


def save_group_details(request):
    parser = OdkParser()
    (is_error, cur_group) = parser.save_group_details(request)

    if is_error is True:
        return return_json({'error': True, 'message': 'There was an error while fetching data from the database.'})

    (is_success, group_settings) = parser.get_form_groups_info(1, 10, 0, None, None)

    return return_json({'error': False, 'group_settings': group_settings})


def refresh_view_data(request):
    parser = OdkParser()

    try:
        form_view = FormViews.objects.filter(id=request.POST['view_id'])
        # form_view = FormViews.objects.filter(id='265')
        if form_view.count() == 0:
            return return_json({'error': True, 'message': "The view with the id '%s' was not found!" % request.POST['view_id']})

        form_view = form_view[0]
        odk_form = ODKForm.objects.get(id=form_view.form_id)
        # form_id, nodes, d_format, download_type, view_name, uuids=None, update_local_data=True, is_dry_run=True
        res = parser.fetch_merge_data(odk_form.form_id, form_view.structure, None, 'submissions', form_view.view_name, None, True, settings.IS_DRY_RUN)

        return return_json({'error': False, 'message': "The view '%s' has been updated successfully. Current total records %d" % (form_view.view_name, len(res))})
    except Exception as e:
        return return_json({'error': True, 'message': "There was an error while refreshing the saved views data. '%s'" % str(e)})


def zip_response(json_data):
    gzip_buffer = IO()
    gzip_file = gzip.GzipFile(mode='wb', fileobj=gzip_buffer)
    gzip_file.write(json_data)
    gzip_file.close()

    response = HttpResponse(content_type='application/json')

    response.data = gzip_buffer.getvalue()
    response.headers['Content-Encoding'] = 'gzip'
    response.headers['Vary'] = 'Accept-Encoding'
    response.headers['Content-Length'] = len(response.data)

    return response