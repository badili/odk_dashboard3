from django.conf.urls import url
from django.urls import include, path, re_path

from odk_dashboard import views
urlpatterns = [
    url(r'^login$', views.login_page, name='login_page'),
    url(r'^logout/$', views.user_logout, name='user_logout'),
    url(r'^form_structure/', views.form_structure, name='form_structure'),
    url(r'^update_db/', views.update_db, name='update_db'),
    url(r'^form_structure/', views.form_structure, name='form_structure'),
    url(r'^download/$', views.download_page, name='download_page'),
    url(r'^manage_views/$', views.manage_views, name='manage_views'),
    url(r'^manage_mappings/$', views.manage_mappings, name='manage_mappings'),
    url(r'^edit_view/$', views.modify_view, name='modify_view'),
    url(r'^delete_view/$', views.modify_view, name='modify_view'),
    url(r'^get_data/$', views.download_data, name='download_data'),
    url(r'^refresh_forms/$', views.refresh_forms, name='refresh_forms'),
    url(r'^create_mapping/$', views.create_mapping, name='create_mapping'),
    url(r'^edit_mapping/$', views.edit_mapping, name='edit_mapping'),
    url(r'^delete_mapping/$', views.delete_mapping, name='delete_mapping'),
    url(r'^validate_mappings/$', views.validate_mappings, name='validate_mappings'),
    url(r'^clear_mappings/$', views.clear_mappings, name='clear_mappings'),
    url(r'^manual_data_process/$', views.manual_data_process, name='manual_data_process'),
    url(r'^delete_processed_data/$', views.delete_processed_data, name='delete_processed_data'),
    url(r'^processing_errors/$', views.processing_errors, name='processing_errors'),
    url(r'^fetch_processing_errors/$', views.fetch_processing_errors, name='fetch_processing_errors'),
    url(r'^fetch_single_error/$', views.fetch_single_error, name='fetch_single_error'),
    url(r'^map_visualization/$', views.map_visualization, name='map_visualization'),
    url(r'^first_level_geojson/$', views.first_level_geojson, name='first_level_geojson'),
    url(r'^save_json_edits/$', views.save_json_edits, name='save_json_edits'),
    url(r'^process_single_submission/$', views.process_single_submission, name='process_single_submission'),
    url(r'^processing_status/$', views.processing_status, name='processing_status'),
    url(r'^fetch_processing_status/$', views.fetch_processing_status, name='fetch_processing_status'),
    url(r'^system_settings/$', views.system_settings, name='system_settings'),
    url(r'^save_settings/$', views.save_settings, name='save_settings'),
    url(r'^forms_settings/$', views.forms_settings, name='forms_settings'),
    url(r'^forms_settings_info/$', views.forms_settings_info, name='forms_settings_infoinfo'),
    url(r'^fetch_form_details/$', views.fetch_form_details, name='fetch_form_details'),
    url(r'^save_form_details/$', views.save_form_details, name='save_form_details'),
    url(r'^form_groups_info/$', views.form_groups_info, name='form_groups_info'),
    url(r'^save_group_details/$', views.save_group_details, name='save_group_details'),
    url(r'^refresh_view_data/$', views.refresh_view_data, name='refresh_view_data'),

    # re_path(r'^save_user_password$', views.save_user_password, name='save_user_password'),
    re_path(r'^new_user_password/?(?P<uid>[0-9A-Za-z_\-]+)?/?(?P<token>[0-9A-Za-z\-]+)?$', views.new_user_password, name='new_user_password'),
    re_path(r'^recover_password$', views.recover_password, name='recover_password'),

    # user urls
]
