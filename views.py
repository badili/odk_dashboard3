  # Python 2 only

import os
import json
import logging
import traceback
import gzip

from io import StringIO as IO
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.auth.hashers import make_password
from django.contrib.sites.shortcuts import get_current_site
from django.core.exceptions import ValidationError
from django.http.response import HttpResponse, HttpResponseRedirect
from django.shortcuts import render, redirect
from django.middleware import csrf
from django_registration.exceptions import ActivationError
from django_registration.backends.activation.views import RegistrationView, ActivationView
from django.utils import timezone
from django.utils.encoding import force_bytes, force_text
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.urls import reverse

from wsgiref.util import FileWrapper

from vendor.odk_parser import OdkParser
from vendor.terminal_output import Terminal
from vendor.models import ODKForm, FormViews, Profile
from vendor.notifications import Notification

from raven import Client
from sentry_sdk import init as sentry_init, capture_exception as sentry_ce

terminal = Terminal()


class CustomPasswordResetTokenGenerator(PasswordResetTokenGenerator):
    """Custom Password Token Generator Class."""
    def _make_hash_value(self, user, timestamp):
        # Include user email alongside user password to the generated token
        # as the user state object that might change after a password reset
        # to produce a token that invalidated.
        login_timestamp = '' if user.last_login is None\
            else user.last_login.replace(microsecond=0, tzinfo=None)
        return str(user.pk) + user.password + user.email +\
            str(login_timestamp) + str(timestamp)


default_token_generator = CustomPasswordResetTokenGenerator()
sentry = Client(settings.SENTRY_DSN, environment=settings.ENV_ROLE)
sentry_init(settings.SENTRY_DSN, environment=settings.ENV_ROLE)

User = get_user_model()


def login_page(request, *args, **kwargs):
    csrf_token = get_or_create_csrf_token(request)
    page_settings = {'page_title': "%s | Login Page" % settings.SITE_NAME, 'csrf_token': csrf_token}

    try:
        # check if we have some username and password in kwargs
        if 'kwargs' in kwargs:
            # use the explicitly passed username and password over the form filled ones
            username = kwargs['kwargs']['user']['username']
            password = kwargs['kwargs']['user']['pass']
        else:
            username = request.POST['username']
            password = request.POST['pass']

        if 'message' in kwargs:
            page_settings['message'] = kwargs['message']

        if username is not None:
            user = authenticate(username=username, password=password)

            if user is None:
                terminal.tprint("Couldn't authenticate the user... redirect to login page", 'fail')
                page_settings['error'] = settings.SITE_NAME + " could not authenticate you. You entered an invalid username or password"
                page_settings['username'] = username
                return render(request, 'login.html', page_settings)
            else:
                terminal.tprint('All ok', 'debug')
                login(request, user)
                return redirect('/dashboard', request=request)
        else:
            return render(request, 'login.html', {username: username})
    except KeyError as e:
        if settings.DEBUG: sentry.captureException()
        # ask the user to enter the username and/or password
        terminal.tprint('\nUsername/password not defined: %s' % str(e), 'warn')
        page_settings['message'] = page_settings['message'] if 'message' in page_settings else "Please enter your username and password"
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
        if settings.DEBUG: terminal.tprint(str(e), 'fail')
        if settings.DEBUG: logging.error(traceback.format_exc())
        page_settings['message'] = "There was an error while authenticating you. Please try again and if the error persist, please contact the system administrator"
        return render(request, 'login.html', page_settings)


def user_logout(request):
    logout(request)
    # specifically clear this session variable
    if 'cur_user' in request.session:
        del request.session['cur_user']

    return redirect('/', request=request)


def under_review_page(request):
    return render(request, 'under_review.html')


def landing_page(request):
    get_or_create_csrf_token(request)
    # return render(request, 'landing_page.html')
    return render(request, 'azizi_amp.html')


def update_password(uid, password, token):
    try:
        User = get_user_model()
        uuid = force_text(urlsafe_base64_decode(uid))
        user = User.objects.get(id=uuid)

        user.set_password(password)
        user.save()
        
        # send an email that the account has been activated
        email_settings = {
            'template': 'emails/general-email.html',
            'subject': '[%s] Password Updated' % settings.SITE_NAME,
            'sender_email': settings.SENDER_EMAIL,
            'recipient_email': user.email,
            'use_queue': getattr(settings, 'QUEUE_EMAILS', False),
            'title': 'Password Updated',
            'message': 'Dear %s,<br /><p>You have successfully updated your password to the %s. You can now log in using your new password.</p>' % (user.first_name, settings.SITE_NAME),
        }
        notify = Notification()
        notify.send_email(email_settings)

        return user.email

    except Exception as e:
        if settings.DEBUG: terminal.tprint(str(e), 'fail')
        sentry.captureException()
        raise


def activate_user(request, user, token):
    try:
        uid = force_text(urlsafe_base64_decode(user))
        user = User.objects.get(pk=uid)

        activation_view = ActivationView()
        activation_view.validate_key(token)

        user.is_active = True
        user.save()

        # send an email that the account has been activated
        email_settings = {
            'template': 'emails/general-email.html',
            'subject': '[%s] Account Activated' % settings.SITE_NAME,
            'sender_email': settings.SENDER_EMAIL,
            'recipient_email': user.email,
            'use_queue': getattr(settings, 'QUEUE_EMAILS', False),
            'title': 'Account Activated',
            'message': 'Thank you for confirming your email. Your account at %s is now active.' % settings.SITE_NAME,
        }
        notify = Notification()
        notify.send_email(email_settings)
        
        uid = urlsafe_base64_encode(force_bytes(user.email))
        return HttpResponseRedirect(reverse('new_user_password', kwargs={'uid': uid}))
    
    except ActivationError as e:
        if settings.DEBUG: terminal.tprint(str(e), 'fail')
        sentry.captureException()
        return reverse('home', kwargs={'error': True, 'message': e.message})

    except User.DoesNotExist as e:
        if settings.DEBUG: terminal.tprint(str(e), 'fail')
        sentry.captureException()
        return reverse('home', kwargs={'error': True, 'message': 'The specified user doesnt exist' })

    except Exception as e:
        if settings.DEBUG: terminal.tprint(str(e), 'fail')
        sentry.captureException()
        return reverse('home', kwargs={'error': True, 'message': 'There was an error while activating your account. Contact the system administrator' })


def new_user_password(request, uid=None, token=None):
    # the uid can be generated from a redirect when a user confirms their account
    # if not set, the user will have set their email on a user page
    current_site = get_current_site(request)
    params = {'site_name': settings.SITE_NAME, 'page_title': settings.SITE_NAME}
    
    # the uid is actually an encoded email
    try:
        if uid and token:
            # we have a user id and token, so we can present the new password page
            params['token'] = token
            params['user'] = uid
            return render(request, 'new_password.html', params)
        else:
            # lets send an email with the reset link
            user = User.objects.filter(email=request.POST.get('email')).get()
            notify = Notification()
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            email_settings = {
                'template': 'emails/verify_account.html',
                'subject': '[%s] Password Recovery Link' % settings.SITE_NAME,
                'sender_email': settings.SENDER_EMAIL,
                'recipient_email': user.email,
                'title': 'Password Recovery Link',
                'salutation': 'Dear %s' % user.first_name,
                'use_queue': getattr(settings, 'QUEUE_EMAILS', False),
                'verification_link': 'http://%s/new_user_password/%s/%s' % (current_site.domain, uid, token),
                'message': 'Someone, hopefully you tried to reset their password on %s. Please click on the link below to reset your password.' % settings.SITE_NAME,
                'message_sub_heading': 'Password Reset'
            }
            notify.send_email(email_settings)

        params['is_error'] = False
        params['message'] = 'We have sent a password recovery link to your email.'
        return render(request, 'login.html', params)

    except User.DoesNotExist as e:
        params['error'] = True
        sentry.captureException()
        params['message'] = 'Sorry, but the specified user is not found in our system'
        return render(request, 'recover_password.html', params)

    except Exception as e:
        if settings.DEBUG: print(str(e))
        sentry.captureException()
        return render(request, 'login.html', {'is_error': True, 'message': 'There was an error while saving the new password'})


def save_user_password(request):
    # save the user password and redirect to the dashboard page
    try:
        passwd = request.POST.get('pass')
        repeat_passwd = request.POST.get('repeat_pass')

        if passwd != repeat_passwd:
            params['error'] = True
            params['message'] = "Sorry! Your passwords don't match. Please try again"
            params['token'] = request.POST.get('token')
            return render(request, 'new_user_password.html', params)

        u_data = dash_views.update_password(request, request.POST.get('token'), passwd)

        # seems all is good, now login and return the dashboard
        return dash_views.login_page(request, message='You have set a new password successfully. Please log in using the new password.', user={'pass': passwd, 'username': u_data['username']})
    except Exception as e:
        if settings.DEBUG: print(str(e))
        return render(request, 'login.html', {'is_error': True, 'message': 'There was an error while saving the new password'})


def recover_password(request):
    current_site = get_current_site(request)
    # the uid is actually an encoded email
    params = {'site_name': settings.SITE_NAME, 'token': ''}

    return render(request, 'recover_password.html', params)


# @login_required(login_url='/login')
def download_page(request):
    csrf_token = get_or_create_csrf_token(request)

    # get all the data to be used to construct the tree
    parser = OdkParser()
    is_first_login = parser.is_first_login()
    if settings.USE_DB_SETTINGS:
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
        if settings.DEBUG: print(str(e))
        return HttpResponse(traceback.format_exc())

    return HttpResponse(json.dumps({'error': False, 'message': 'Database updated'}))


# @login_required(login_url='/login')
def form_structure(request):
    # given a form id, get the structure for the form
    parser = OdkParser()

    is_first_login = parser.is_first_login()
    if settings.USE_DB_SETTINGS:
        are_ona_settings_saved = parser.are_ona_settings_saved()
    # if is_first_login is True or are_ona_settings_saved is False:
    #     return system_settings(request)

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
    parser = OdkParser(None, None, settings.ONADATA_TOKEN)
    is_first_login = parser.is_first_login()
    
    if settings.USE_DB_SETTINGS:
        are_ona_settings_saved = parser.are_ona_settings_saved()
        if is_first_login is True or are_ona_settings_saved is False:
            return system_settings(request)

    try:
        data = json.loads(request.body)
        # form_id, nodes, d_format, download_type, view_name, uuids=None, update_local_data=True, is_dry_run=True
        # data['filter'] = {}
        filters = data['filter_by'] if 'filter_by' in data else None
        res = parser.fetch_merge_data(data['form_id'], data['nodes[]'], data['format'], data['action'], data['view_name'], None, True, settings.IS_DRY_RUN, filters)
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

    if settings.USE_DB_SETTINGS:
        are_ona_settings_saved = parser.are_ona_settings_saved()
        if is_first_login is True or are_ona_settings_saved is False:
            return system_settings(request)

    try:
        data = json.loads(request.body)
        filename = parser.fetch_data(data['form_id'], data['nodes[]'], data['format'])
    except KeyError:
        return HttpResponse(traceback.format_exc())
    except Exception as e:
        if settings.DEBUG: print(str(e))
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

    if settings.USE_DB_SETTINGS:
        are_ona_settings_saved = parser.are_ona_settings_saved()
        if is_first_login is True or are_ona_settings_saved is False:
            return system_settings(request)

    try:
        # when refreshing the forms, dont process the groups but auto-create the form groups
        all_forms = parser.refresh_forms(False, True)
    except Exception:
        logging.error(traceback.format_exc())

    return HttpResponse(json.dumps({'error': False, 'all_forms': all_forms}))


@login_required(login_url='/login')
def add_user(request):
    # given a user details add the user
    # 1. Get the next personnel code
    # 1. Add the details of the user and set is_active to 0. Generate a password
    # 2. Send email to the user with the activation link
    
    try:
        UserModel = get_user_model()

        nickname=request.POST.get('username')
        username=request.POST.get('username')
        designation=request.POST.get('designation')
        tel=request.POST.get('tel')
        email=request.POST.get('email')
        first_name=request.POST.get('first_name')
        last_name=request.POST.get('surname')

        new_user = UserModel(
            nickname=username,
            username=username,
            designation=designation,
            tel=tel,
            email=email,
            first_name=first_name,
            last_name=last_name,
            password=make_password('TestPass1234'),
            is_active=0
        )
        new_user.full_clean()
        new_user.save()

        reg_view = RegistrationView()
        activation_link = reg_view.get_activation_key(new_user)

        # send an email to this user
        notify = Notification()
        uid = urlsafe_base64_encode(force_bytes(new_user.pk))
        current_site = get_current_site(request)

        email_settings = {
            'template': 'emails/verify_account.html',
            'subject': '[%s] Confirm Registration' % settings.SITE_NAME,
            'sender_email': settings.SENDER_EMAIL,
            'recipient_email': email,
            'site_name': settings.SITE_NAME,
            'site_url': 'http://%s' % current_site.domain,
            'title': 'Confirm Registration',
            'salutation': 'Dear %s' % first_name,
            'use_queue': getattr(settings, 'QUEUE_EMAILS', False),
            'verification_link': 'http://%s/activate_new_user/%s/%s' % (current_site.domain, uid, activation_link),
            'message': 'You have been registered successfully to the %s. We are glad to have you on board. Please click on the button below to activate your account. You will not be able to use your account until it is activated. The activation link will expire in %d hours' % (settings.SITE_NAME, settings.ACCOUNT_ACTIVATION_DAYS * 24),
            'message_sub_heading': 'You have been registered successfully'
        }
        notify.send_email(email_settings)

        return {'error': False, 'message': 'The user has been saved successfully'}
    
    except ValidationError as e:
        return {'error': True, 'message': 'There was an error while saving the user: %s' % str(e)}
    except Exception as e:
        if settings.DEBUG: terminal.tprint(str(e), 'fail')
        sentry_ce()
        raise


@login_required(login_url='/login')
def update_user(request, user_id):
    try:
        UserModel = get_user_model()
        cur_user = User.objects.get(id=user_id)

        nickname=request.POST.get('username')
        username=request.POST.get('username')
        designation=request.POST.get('designation')
        tel=request.POST.get('tel')
        email=request.POST.get('email')
        first_name=request.POST.get('first_name')
        last_name=request.POST.get('surname')

        cur_user.nickname = username
        cur_user.username = username
        cur_user.designation = designation
        cur_user.tel = tel
        cur_user.email = email
        cur_user.first_name = first_name
        cur_user.last_name = last_name

        cur_user.full_clean()
        cur_user.save()
    
    except ValidationError as e:
        return {'error': True, 'message': 'There was an error while saving the user: %s' % str(e)}
    except Exception as e:
        if settings.DEBUG: terminal.tprint(str(e), 'fail')
        sentry_ce()
        raise


def get_or_create_csrf_token(request):
    token = request.META.get('CSRF_COOKIE', None)
    if token is None:
        # Getting a new token
        token = csrf.get_token(request)
        request.META['CSRF_COOKIE'] = token

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