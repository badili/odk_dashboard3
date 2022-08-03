function BadiliDash() {
    this.data = {};
    this.theme = '';        // for jqWidgets
    this.console = console;
    this.currentView = undefined;
    this.csrftoken = $('meta[name=csrf-token]').attr('content');
    this.reEscape = new RegExp('(\\' + ['/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\'].join('|\\') + ')', 'g')
    this.d3_width = 900;
    this.d3_height = 300;
    this.default_zoom = {minZoom: 6, maxZoom: 24};
    this.objects = function(){};

    $.ajaxSetup({
      beforeSend: function(xhr, settings) {
        if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type)) {
            xhr.setRequestHeader("X-CSRFToken", dash.csrftoken)
        }
      }
    });

    this.base_color = {
        "color": "#628cff",
        "weight": 1,
        "fill-opacity": 1.3
    };

    this.backgroundColor1 = [
        'rgba(255, 99,  132, 0.2)', 'rgba(54,  162, 235, 0.2)', 'rgba(255, 206, 86,  0.2)', 'rgba(75,  192, 192, 0.2)',
        'rgba(153, 102, 255, 0.2)', 'rgba(255, 159, 64,  0.2)'
    ];

    this.backgroundColor2 = [
        'rgba(255,128,128, 0.8)', 'rgba(255,156,128, 0.8)', 'rgba(255,184,128, 0.8)', 'rgba(255,212,128, 0.8)',
        'rgba(255,241,128, 0.8)', 'rgba(241,255,128, 0.8)', 'rgba(213,255,128, 0.8)', 'rgba(184,255,128, 0.8)',
        'rgba(156,255,128, 0.8)', 'rgba(128,255,128, 0.8)', 'rgba(128,255,156, 0.8)', 'rgba(128,255,184, 0.8)',
        'rgba(128,255,212, 0.8)', 'rgba(128,255,241, 0.8)', 'rgba(128,241,255, 0.8)', 'rgba(128,212,255, 0.8)',
        'rgba(128,184,255, 0.8)', 'rgba(128,156,255, 0.8)', 'rgba(128,128,255, 0.8)', 'rgba(156,128,255, 0.8)',
        'rgba(184,128,255, 0.8)', 'rgba(212,128,255, 0.8)', 'rgba(241,128,255, 0.8)', 'rgba(255,128,241, 0.8)',
        'rgba(255,128,213, 0.8)', 'rgba(255,128,184, 0.8)', 'rgba(255,128,156, 0.8)',
    ];

    this.bgColors = [
        [
            'rgba(255, 99,  132, 0.2)', 'rgba(54,  162, 235, 0.2)', 'rgba(255, 206, 86,  0.2)', 'rgba(75,  192, 192, 0.2)',
            'rgba(153, 102, 255, 0.2)', 'rgba(255, 159, 64,  0.2)'
        ],
        [
            '#ff8080', '#ff9c80', '#ffb880', '#ffd480', '#fff180', '#f1ff80', '#d5ff80', '#b8ff80', '#9cff80','#80ff80',
            '#80ff9c', '#80ffb8', '#80ffd4', '#80fff1', '#80f1ff', '#80d4ff', '#80b8ff', '#809cff', '#8080ff', '#9c80ff',
            '#b880ff', '#d480ff', '#f180ff', '#ff80f1', '#ff80d5', '#ff80b8', '#ff809c',
        ]
    ];

    this.default_template = "<div class=\"col-lg-6\">\n\
        <div class=\"ibox float-e-marg\">\n\
            <div class=\"ibox-title\">\n\
                <h5>%s</h5>\n\
            </div>\n\
            <div class=\"ibox-content\">\n\
                <div>\n\
                    <canvas id='%s' height='200'></canvas>\n\
                </div>\n\
            </div>\n\
        </div>\n\
    </div>";

    this.liv_keeping_template = "<div class=\"col-lg-6\">\n\
        <div class=\"ibox float-e-marg\">\n\
            <div class=\"ibox-title\">\n\
                <h5>\n\
                    %s\n\
                    <small>Primary vs Secondary Reasons</small>\n\
                </h5>\n\
            </div>\n\
            <div class=\"ibox-content\">\n\
                <div>\n\
                    <canvas id='%s' height='200'></canvas>\n\
                </div>\n\
            </div>\n\
        </div>\n\
    </div>";
    var merged_views_end = "</div>";

    $(document).on('select', '#all_forms', function(event){
        var args = event.args;
        if (args) {
            // get the form structure
            dash.formStructure(args.item.originalItem.uid);
        }
    });

    $(document).on('select', '#all_tables', function(event){
        var args = event.args;
        if (args) {
            // get the form structure
            dash.showTableStructure(args.item.originalItem.uid);
        }
    });

    //On Global Checkbox Toggle, set all rows' checkbox to checked and toggle _selection values
    $(document).on('change', ".global-checkbox", function() {
        var newValues = {};
        if ( $(this).prop("checked") ) {
            newValues._selection = 'True';
            newValues._checkbox = '<input type="checkbox" class="row-checkbox" checked>';
        } else {
            newValues._selection = 'False';
            newValues._checkbox = '<input type="checkbox" class="row-checkbox">';
        }
        $.each(dash.ft.rows.all, function( index, values ) {
            dash.ft.rows.update(index, newValues, false);
        });
        dash.ft.draw();
    });

    //On Single Row Checkbox Toggle
    $(document).on('click', '.row-checkbox', function() {
        var newValues = {};
        var row = $(this).closest('tr').data('__FooTableRow__');
        if ( $(this).prop('checked') ) {
            //Prepare Values
            newValues._selection = 'True';
            newValues._checkbox = '<input type="checkbox" class="row-checkbox" checked>';
        } else {
            //Prepare Values
            newValues._selection = 'False';
            newValues._checkbox = '<input type="checkbox" class="row-checkbox">';

            //Toggle globalCheckbox if checked
            if ( $globalCheckbox.prop('checked') ) {
                 $globalCheckbox.prop('checked', false);
            }
        }
        row.val(newValues, true);
    });
    
    $('#confirm_process_submission').unbind('click').on('click', this.processCurSubmission);
    $('#save_sys_settings, #save_db_settings, #save_ona_settings').on('click', this.saveSystemSettings);
    $('#new_form_group').on('click', function(){
        $('#form-group-modal').modal('show');
    });

    
    $(document).on('click', '#confirm_clear_mappings', this.clearMappings);
    $(document).on('click', '#dry_run', function(){
        dash.executeProcessingDryRun(true);
    });
    $(document).on('click', '#confirm_process_mappings', this.executeDataProcessor);
    $(document).on('click', '#confirm_delete_data', this.clearProcessedData);
    $(document).on('click', '#confirm_save_edits', this.saveEditedJson);
    $(document).on('click', '#test_mappings', this.validateMappings);
    $(document).on('click', '.edit_record', this.viewRawSubmission);
    $(document).on('click', '#form_settings_table .edit_form', this.editFormSettings);
    $(document).on('click', '#save_form_details', this.saveFormSettings);
    $(document).on('click', '#save_group_details', this.saveGroupDetails);
    $(document).on('click', '.refresh_view_data', this.refreshViewData);
    $(document).on('dblclick', '#json-renderer', this.showNodeValue);
    $(document).on('click', '.cancel-edits', this.cancelEdits);
    $(document).on('click', '#confirmModal #confirm', this.saveChanges);
    $(document).on('click', '.save-edits', function(){
        // confirm modal for edits
        // check that we have a reason for edits and one checkbox is selected
        if($('#change_reason').val() == ''){
            dash.showNotification('Please enter a reason for editing the raw ODK data.', 'error', true);
            return;
        }
        if($("input[type='radio'][name='reprocess']:checked").val() == undefined){
            dash.showNotification('Please select whether to reprocess the processed data.', 'error', true);
            return;
        }
        try {
            JSON.parse($('#json_editor').val());
        }
        catch (e) {
            dash.showNotification('The modified data is invalid. Please try again later.', 'error', true);
            return;
        }
        $('#modal_message').html(`Are you sure you want to edit the RAW ODK data. This action is potentially dangerous`);
        $('#confirmModal').modal('show');
    });
}

BadiliDash.prototype.initiate = function(){
    // initiate the creation of the interface
    this.initiateAllForms();
    this.initiateButtonsRadios();
};

/**
 * Creates a combobox with a list of all the forms
 * @returns {undefined}
 */
BadiliDash.prototype.initiateAllForms = function(){
    console.log(dash.data.all_forms);
    var source = {
        localdata: dash.data.all_forms,
        id:"id",
        datatype: "json",
        datafields:[ {name:"id"}, {name:"title"} ]
    };
    var data_source = new $.jqx.dataAdapter(source);
    $("#all_forms").jqxComboBox({ selectedIndex: 0, source: data_source, displayMember: "title", valueMember: "id", width: '97%', theme: dash.theme });
    $("#all_forms").addClass('form-control m-b');
};


BadiliDash.prototype.formStructure = function (form_id) {
    var data = {'form_id': form_id};
    dash.cur_form_id = form_id;

    dash.showLoadingSpinner('Refreshing the form structure');
    $.ajax({
        type: "POST", url: "/form_structure/", dataType: 'json', data: data,
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            if (data.error) {
                console.log(data.message);
                swal({
                  title: "Error!",
                  text: data.message,
                  imageUrl: "/static/img/error-icon.png"
                });
                return;
            } else {
                // console.log(data);
                dash.curFormStructure = data.structure;
                console.log(window.location.pathname);
                if(window.location.pathname == '/download/' || window.location.pathname == '/download'){
                    dash.initiateFormStructureTree();
                }
                else{
                    dash.initiateManageMappingsTree();
                }
            }
        }
    });
};

BadiliDash.prototype.initiateFormStructureTree = function () {
    var source ={
        datatype: "json",
        datafields: [
            { name: 'id', type: 'number' },
            { name: 'parent_id', type: 'number' },
            { name: 'name', type: 'string' },
            { name: 'type', type: 'string' },
            { name: 'label', type: 'string' }
        ],
        hierarchy:{
            keyDataField: { name: 'id' },
            parentDataField: { name: 'parent_id' }
        },
        id: 'id',
        localdata: dash.curFormStructure
    };

    // create data adapter.
    var dataAdapter = new $.jqx.dataAdapter(source);
   
    $('#form_structure').jqxTreeGrid({ 
        width: '99%', 
        source: dataAdapter, 
        filterable: true,
        height: 550,
        checkboxes: true,
        hierarchicalCheckboxes: true,
        columns: [
          { text: 'Question Names', dataField: 'label', width: '100%', cellclassname: "no_border" }
        ],
    });
};

BadiliDash.prototype.initiateManageMappingsTree = function () {
    var source ={
        datatype: "json",
        datafields: [
            { name: 'id', type: 'number' },
            { name: 'parent_id', type: 'number' },
            { name: 'name', type: 'string' },
            { name: 'type', type: 'string' },
            { name: 'label', type: 'string' }
        ],
        hierarchy:{
            keyDataField: { name: 'id' },
            parentDataField: { name: 'parent_id' }
        },
        id: 'id',
        localdata: dash.curFormStructure
    };

    // create data adapter.
    var dataAdapter = new $.jqx.dataAdapter(source);
    dataAdapter.dataBind();
    dash.cur_form_structure = dataAdapter.getRecordsHierarchy('id', 'parent_id', 'items', [{ name: 'label', map: 'label'}]);
   
    $('#form_structure').jqxTree({ 
        width: '99%', 
        source: dash.cur_form_structure,
        height: 550,
        allowDrag: true,
        dragEnd: dash.finalizeMapping
    });
};

BadiliDash.prototype.initiateButtonsRadios = function(){
    $(".action_btn").on('click', dash.processButtonAction );
    $("#just_download, #download_save").on('click', dash.processDownloadChoice );

    $("#destination .custom").jqxRadioButton({ width: 250, height: 25});
    $("#destination .other").jqxRadioButton({ width: 250, height: 25});
};

BadiliDash.prototype.processRadioAction = function(){};

BadiliDash.prototype.getSelectedItems = function(node){
    $.each(node, function () {
        if (this.checked == true) {
            dash.selected_node_ids[dash.selected_node_ids.length] = this.name;
        }
        if (this.records != undefined){
            dash.getSelectedItems(this.records);
        }
    });
};

BadiliDash.prototype.processButtonAction = function(event){
    
    // save all checked items in selected_node_ids array.
    dash.selected_node_ids = new Array();

    // get all items.
    var top_level = $("#form_structure").jqxTreeGrid('getRows');
    dash.getSelectedItems(top_level);

    if(this.id == 'refresh_btn'){
        console.log('Refreshing the forms from the server');
    }
    else if(this.id == 'dict_btn'){
        console.log('Downloading the dictionary from the server');
    }
    else{
        if(dash.selected_node_ids === undefined){
            console.log('No forms defined...');
            swal({
              title: "Error!",
              text: "Please select at least one FORM to process.",
              imageUrl: "/static/img/error-icon.png"
            });
            return;
        }
        if(dash.selected_node_ids.length === 0){
            console.log('select nodes for processing...');
            swal({
              title: "Error!",
              text: "Please select at least one node for processing.",
              imageUrl: "/static/img/error-icon.png"
            });
            return;
        }
    }

    var action = undefined, data = undefined, loading_text = 'Loading...';
    dash.sel_form = $("#all_forms").jqxComboBox('getSelectedItem');

    switch(this.id){
        case 'get_data_btn':
            $('#confirmModal').modal('show');
            return;
        break;

        case 'update_btn':
            action = '/update_db_struct/';
            loading_text = 'Updating DB structure...';
        break;

        case 'refresh_btn':
            action = '/refresh_forms/';
            loading_text = 'Refreshing forms...';
        break;

        case 'dict_btn':
            dash.downloadData('get_dict/', '', '/get_dict/', 'AnGR-CIM Dictionary');
            return;
        break;

        case 'delete_btn':
            action = '/delete_db/';
        break;
    };

    dash.showLoadingSpinner(loading_text);
    $.ajax({
        type: "POST", url: action, dataType: 'json', data: data,
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            if (data.error) {
                Notification.show({create: true, hide: true, updateText: false, text: 'There was an error while communicating with the server', error: true});
                return;
            } else {
                if (action == '/refresh_forms/'){
                    dash.data.all_forms = data.all_forms;
                    dash.initiateAllForms();
                }
            }
        }
    });
};

/**
 * Process the download choice that the user has made
 * 
 * @return none
 */
BadiliDash.prototype.processDownloadChoice = function(){
    var view_name = undefined;
    if (this.id == 'download_save'){
        view_name = $('#view_name').val();
        if (view_name == '' || view_name == 'undefined'){
            $('#view_name-group').addClass('has-error');
            swal({
              title: "Error!",
              text: "Please enter the name of the view",
              imageUrl: "/static/img/error-icon.png"
            });
            return;
        }
    }
    // close the modal window
    $('#confirmModal').modal('hide');
    dash.downloadData(this.id, view_name);
};

/**
 * Initiate the download process for the data
 * 
 * @param {string}  action The action selected by the user
 * @param {string}  view_name   The name of the view that the user wants to save
 * @return {none}
 */
BadiliDash.prototype.downloadData = function(user_action, view_name, action='/get_data/', filename=undefined){
    view_name = (view_name == undefined) ? '' : view_name;
    var data = {'nodes[]': dash.selected_node_ids, action: user_action, 'form_id': dash.sel_form.value, 'format': 'xlsx', 'view_name': view_name, 'filter_by': dash.data.filter_by};

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        var a;
        if (xhttp.readyState === 4 && xhttp.status === 200) {
            // if it's an error, process it
            if(xhttp.response.type == 'text/json'){
                var reader = new FileReader();
                reader.onload = function() {
                    var response = JSON.parse(reader.result);
                    dash.destroyLoadingSpinner();
                    swal({
                      title: "Error!",
                      text: response.message,
                      imageUrl: "/static/img/error-icon.png",
                      html: true
                    });
                }
                reader.readAsText(xhttp.response);
                return;
            }

            // Trick for making downloadable link
            a = document.createElement('a');
            a.href = window.URL.createObjectURL(xhttp.response);
            if(filename == undefined){
                // Give filename you wish to download
                var d = new Date();

                var datestring =
                      d.getFullYear() + ("0"+(d.getMonth()+1)).slice(-2) + ("0" + d.getDate()).slice(-2)
                      + "_" +
                      ("0" + d.getHours()).slice(-2) + ("0" + d.getMinutes()).slice(-2) + ("0" + d.getSeconds()).slice(-2);

                a.download = 'Form'+ dash.sel_form.value + '_'+ datestring + '.xlsx';
            }
            else{
                a.download = filename +'.xlsx'
            }
            a.style.display = 'none';
            document.body.appendChild(a);
            dash.destroyLoadingSpinner();
            a.click();
        }
    };

    dash.showLoadingSpinner('Please wait while we process your data for download...');
    // Post data to URL which handles post request
    xhttp.open("POST", action);
    xhttp.setRequestHeader("X-CSRFToken", dash.csrftoken);
    xhttp.setRequestHeader("Content-Type", "application/json");

    // You should set responseType as blob for binary responses
    xhttp.responseType = 'blob';
    xhttp.send(JSON.stringify(data));
};

BadiliDash.prototype.fnFormatResult = function (value, searchString) {
    var pattern = '(' + searchString.replace(dash.reEscape, '\\$1') + ')';
    return value.value.replace(new RegExp(pattern, 'gi'), '<strong>$1<\/strong>');
};


BadiliDash.prototype.createChartDatasets = function(d_data, color_scheme=[dash.backgroundColor2]){
    var datasets = new Array();

    $.each(d_data, function(i, t_data){
        var index = 0;
        $.each(t_data, function(title, data){
            datasets[datasets.length] = {
                label: title,
                backgroundColor: color_scheme[i][index],
                borderColor: color_scheme[i][index],
                borderWidth: 1,
                data: data,
                stack: i+1
            };
            index++;
        });
    });
    

    return datasets;
};

/**
 * Generate HTML section for creating the charts
 * 
 * @param  {[type]} t_data     [description]
 * @param  {[type]} div_prefix [description]
 * @return {[type]}            [description]
 */
BadiliDash.prototype.generateChartsHTMLTemplate = function(t_data, div_prefix, template=dash.default_template){
    var i = 0;
    $.each(t_data, function(country, s_data){
        var view_id = sprintf("%s_%s", div_prefix, country);
        var view = sprintf(template, country, view_id);
        if(i == 0){
            merged_views = "<div class='row'>" + view;
        }
        else if(i % 2 == 0){
            merged_views += "<div class='row'>";
            merged_views += view;
        }
        else{
            merged_views += view;
            merged_views += "</div>";
        }
        i++;
    });

    // if we had an even number, create a placeholder for closing the section
    if(i % 2 == 1){
        merged_views += "<div class='row'>&nbsp;</div>";
    }
    return merged_views;
}

BadiliDash.prototype.initiateViewsManagement = function(){
    // create the grid with the views data
    var $modal = $('#editor-modal'), $editor = $('#editor'), $editorTitle = $('#editor-title');
    var ft;
    var columns = [
        {'name': 'view_id', 'title': 'View ID'},
        {'name': 'view_name', 'title': 'View Name'},
        {'name': 'date_created', 'title': 'Date Created', 'type': 'date'},
        {'name': 'no_sub_tables', 'title': 'Sub Tables'},
        {'name': 'auto_process', 'title': 'Auto Process'},
        {'name': 'actions', 'title': 'Actions'}
    ];

    ft = FooTable.init('#views_table', {
        columns: columns,
        rows: dash.data.views,
        editing: {
            editRow: function(row){
                var values = row.val();
                $editor.find('#view_id').val(values.view_id);
                $editor.find('#view_name').val(values.view_name);
                $editor.find('#auto_process').val(values.auto_process);
                $modal.data('row', row);
                $editorTitle.text('Edit view ' + values.view_name);
                $modal.modal('show');
            },
            deleteRow: function(row){
                if (confirm('Are you sure you want to delete this view?')){
                    console.log('Deleting a row');
                    data = {'view_id': row.value.view_id}
                    dash.showLoadingSpinner('Please wait while we initiate the views...');
                    $.ajax({
                        type: "POST", url: "/delete_view/", dataType: 'json', data: {'view': JSON.stringify(data)},
                        error: dash.communicationError,
                        success: function (data) {
                            dash.destroyLoadingSpinner();
                            if (data.error) {
                                console.log(data.message);
                                swal({
                                  title: "Error!",
                                  text: data.message,
                                  imageUrl: "/static/img/error-icon.png"
                                });
                                return;
                            }
                            else {
                                // all is ok, so delete the row on the interface
                                row.delete();
                                swal({
                                  title: "Success",
                                  text: "The view has been deleted successfully",
                                  imageUrl: "/static/img/success-icon.png"
                                });
                            }
                        }
                    });
                }
            }
        }
    }),
    uid = 10001;

    $editor.on('submit', dash.submitViewEdits);
};

BadiliDash.prototype.submitViewEdits = function(e){
    var $modal = $('#editor-modal'), $editor = $('#editor'), $editorTitle = $('#editor-title');
    if (this.checkValidity && !this.checkValidity()){
        return;
    }
    e.preventDefault();
    var row = $modal.data('row'),
        values = {
            view_id: $editor.find('#view_id').val(),
            view_name: $editor.find('#view_name').val(),
            auto_process: $editor.find('#auto_process').val()
        };

    dash.showLoadingSpinner('Please wait while we save your changes...');
    $.ajax({
        type: "POST", url: "/edit_view/", dataType: 'json', data: {'view': JSON.stringify(values)},
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            if (data.error) {
                console.log(data.message);
                swal({
                  title: "Error!",
                  text: data.message,
                  imageUrl: "/static/img/error-icon.png"
                });
                return;
            }
            else {
                // all is ok, modify the data on the table view
                if (row instanceof FooTable.Row){
                    row.val(values);
                } else {
                    values.id = uid++;
                    ft.rows.add(values);
                }
            }
        }
    });
    
    $modal.modal('hide');
};

BadiliDash.prototype.initiateIncidentsMap = function(){
    console.log("Initiating maps...");
    var testData = {
      // max: 8,
      data: dash.data.locations
    };
    var baseLayer = L.tileLayer(
      'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        attribution: ' <a href="https://badili.co.ke">Badili Innovations</a>',
        maxZoom: 18
      }
    );

    var cfg = {
      // radius should be small ONLY if scaleRadius is true (or small radius is intended)
      // if scaleRadius is false it will be the constant radius used in pixels
      "radius": 0.07,
      "maxOpacity": .8, 
      // scales the radius based on map zoom
      "scaleRadius": true, 
      // if set to false the heatmap uses the global maximum for colorization
      // if activated: uses the data maximum within the current map boundaries 
      //   (there will always be a red spot with useLocalExtremas true)
      "useLocalExtrema": false,
      // which field name in your data represents the latitude - default "lat"
      latField: 'lat',
      // which field name in your data represents the longitude - default "lng"
      lngField: 'lng',
      // which field name in your data represents the data value - default "value"
      valueField: 'count'
    };

    var heatmapLayer = new HeatmapOverlay(cfg);
    var map = new L.Map('reporting_map', {
      center: new L.LatLng(dash.data.center_point.lat, dash.data.center_point.lng),
      zoom: 8,
      layers: [baseLayer, heatmapLayer]
    });

    heatmapLayer.setData(testData);
};

/**
 * Show a notification on the page
 *
 * @param   message     The message to be shown
 * @param   type        The type of message
 */
BadiliDash.prototype.showNotification = function(message, type, autoclose){
    if(type === undefined) { type = 'error'; }
    if(autoclose === undefined) { autoclose = true; }

    if($('#messageNotification').jqxNotification('width') === undefined){
        $('#messageNotification').jqxNotification({
            width: 350, position: 'top-right', opacity: 0.9,
            autoOpen: false, animationOpenDelay: 800, autoClose: autoclose, template: type
        });
    }
    $('#messageNotification .jqx-notification-content div').html(message);
    $('#messageNotification').jqxNotification({template: type});
    $('#messageNotification').jqxNotification('open');
};

BadiliDash.prototype.communicationError = function(){
    dash.destroyLoadingSpinner();
};

/**
 * Creates a combobox with a list of all the forms
 * @returns {undefined}
 */
BadiliDash.prototype.initiateTablesCombo = function(){
    var source = {
        localdata: dash.data.all_tables,
        id:"id",
        datatype: "json",
        datafields:[ {name:"id"}, {name:"title"} ]
    };
    var data_source = new $.jqx.dataAdapter(source);
    $("#all_tables").jqxComboBox({ selectedIndex: 0, source: data_source, displayMember: "title", valueMember: "id", width: '97%', theme: dash.theme });
    $("#all_tables").addClass('form-control m-b');
};

BadiliDash.prototype.showTableStructure = function(table_id){
    var table_fields = [];
    $.each(dash.data.all_columns, function(){
        if(this.parent_id == table_id){
            table_fields[table_fields.length] = this;
        }
    });

    var source ={
        datatype: "json",
        datafields: [
            { name: 'id', type: 'number' },
            { name: 'parent_id', type: 'number' },
            { name: 'title', type: 'string' },
            { name: 'field', type: 'string' },
            { name: 'type', type: 'string' }
        ],
        id: 'id',
        localdata: table_fields
    };

    // create data adapter.
    var dataAdapter = new $.jqx.dataAdapter(source);
    dataAdapter.dataBind();
    dash.cur_table_structure = dataAdapter.getRecordsHierarchy('id', 'parent_id', 'items', [{ name: 'title', map: 'label'}]);
   
    $('#table_structure').jqxTree({ 
        width: '99%',
        allowDrop: true,
        dropAction: 'none',
        source: dash.cur_table_structure,
        height: 550
    });

};

BadiliDash.prototype.finalizeMapping = function(dragItem, dropItem, a, position, c){
    console.log(position);
    if(position != 'inside'){
        dash.showNotification('Please drag the question INTO a column', 'error', true);
        return;
    }
    var table = $("#all_tables").jqxComboBox('getSelectedItem').originalItem;
    var form = $("#all_forms").jqxComboBox('getSelectedItem').originalItem;
    var drop_item = dash.jqxRecursion(dash.cur_table_structure, dropItem.id);
    var drag_item = dash.jqxRecursion(dash.cur_form_structure, parseInt(dragItem.id));
    if(drag_item == undefined){
        dash.showNotification('There was an error while mapping the fields. Please try again', 'danger', true);
        return;
    }
    drag_item.parent = undefined;

    var s_data = {'table': table, 'form': form, 'table_item': drag_item, 'drop_item': drop_item};

    $.ajax({
        type: "POST", url: "/create_mapping/", dataType: 'json', data: JSON.stringify(s_data),
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            if (data.error) {
                swal({
                  title: "Error!",
                  text: data.message,
                  imageUrl: "/static/img/error-icon.png"
                });
                return;
            } else {
                dash.showNotification('The mapping was successful', 'success', true);
                dash.refreshMappingsTable(data.mappings);
            }
        }
    });
};

BadiliDash.prototype.refreshMappingsTable = function(data){
    // create the grid with the views data
    var $modal = $('#mapping-modal'), $editor = $('#mapping_editor'), $editorTitle = $('#editor-title');
    var ft;
    var columns = [
        {'name': 'mapping_id', 'title': 'ID', 'visible': false},
        {"name":"_selection", "title" : "Selection", 'visible': false, "sortable": false, "filterable":false},
        {"name":"_checkbox", "title" : "<input type='checkbox' class='global-checkbox'>", 'visible': true, "sortable": false, "filterable":false},
        {'name': 'form_group', 'title': 'Form Group'},
        {'name': 'form_question', 'title': 'Survey Question'},
        {'name': 'odk_question_type', 'title': 'ODK Qst Type'},
        {'name': 'dest_table_name', 'title': 'Dest Table'},
        {'name': 'dest_column_name', 'title': 'Dest Column'},
        {'name': 'db_question_type', 'title': 'Dest Type'},
        {'name': 'validation_regex', 'title': 'Validation REGEX', 'width': '120px'},
        {'name': 'is_record_identifier', 'title': 'Is Identifier'},
        {'name': 'is_lookup_field', 'title': 'Is Lookup'},
        {'name': 'use_current_time', 'title': 'Auto Time'}
    ];

    if(dash.ft == undefined){
        dash.ft = FooTable.init('#mappings_table', {
            columns: columns,
            rows: data,
            editing: {
                alwaysShow: true,
                editRow: function(row){
                    var values = row.val();
                    $editor.find('#mapping_id').val(values.mapping_id);
                    $editor.find('#regex_validator').val(values.validation_regex);
                    if (values.is_record_identifier == true){
                        $editor.find('#is_record_id_yes').prop('checked', true);
                    }
                    else{
                        $editor.find('#is_record_id_no').prop('checked', true);
                    }
                    $modal.data('row', row);
                    $editorTitle.text(sprintf('Add validator for %s - %s', values.form_question, values.dest_column_name ));
                    $modal.modal('show');
                },
                deleteRow: dash.deleteMapping
            }
        }),
        uid = 10001;
        $editor.on('submit', dash.submitMappingEdits);
    }
    else{
        dash.ft.rows.load(data);
    }
    if(data.length != 0){
        $('#test_mappings').removeClass('disabled');
        $('#clear_mappings').removeClass('disabled');
    }
};

BadiliDash.prototype.submitMappingEdits = function(e){
    var $modal = $('#mapping-modal'), $editor = $('#mapping_editor'), $editorTitle = $('#editor-title');
    if (this.checkValidity && !this.checkValidity()){
        return;
    }
    e.preventDefault();
    var row = $modal.data('row'),
        values = {
            mapping_id: $editor.find('#mapping_id').val(),
            regex_validator: $editor.find('#regex_validator').val(),
            is_record_id: $editor.find('[name=is_record_id]:checked').val() == 'yes' ? true : false,
            is_lookup_id: $editor.find('[name=is_lookup_id]:checked').val() == 'yes' ? true : false
        };

    dash.showLoadingSpinner('Please wait while we save your changes...');
    $.ajax({
        type: "POST", url: "/edit_mapping/", dataType: 'json', data: {'mapping': JSON.stringify(values)},
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            if (data.error) {
                dash.showNotification(data.message, 'danger', true);
                return;
            }
            else {
                dash.refreshMappingsTable(data.mappings);
            }
        }
    });
    $modal.modal('hide');
}

BadiliDash.prototype.deleteMapping = function(row){
    if (confirm('Are you sure you want to delete this mapping?')){
        data = {'mapping_id': row.value.mapping_id}
        dash.showLoadingSpinner('Please wait while we delete the mappings...');
        $.ajax({
            type: "POST", url: "/delete_mapping/", dataType: 'json', data: {'mappings': JSON.stringify(data)},
            error: dash.communicationError,
            success: function (data) {
                dash.destroyLoadingSpinner();
                if (data.error) {
                    swal({
                      title: "Error!",
                      text: data.message,
                      imageUrl: "/static/img/error-icon.png"
                    });
                    return;
                }
                else {
                    // all is ok, so delete the row on the interface
                    row.delete();
                    swal({
                      title: "Success",
                      text: "The mapping has been deleted successfully",
                      imageUrl: "/static/img/success-icon.png"
                    });
                }
            }
        });
    }
};

BadiliDash.prototype.jqxRecursion = function (objects, element_id) {
    console.log('Element id'+ element_id);
    for (var i = 0; i < objects.length; i++) {
        if (element_id == objects[i].id) {
            return objects[i];
        } 
        else if (objects[i].items != undefined) {  
            var item = dash.jqxRecursion(objects[i].items, element_id);
            if (item != undefined){
                return item;
            }
        };
    };
    return undefined;
};

BadiliDash.prototype.validateMappings = function(){
    dash.showLoadingSpinner('Please wait while we validate your mappings...');
    $.ajax({
        type: "POST", url: "/validate_mappings/", dataType: 'json', data: {},
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            if (data.error) {
                console.log(data.message);
                swal({
                  title: "Error!",
                  text: data.message,
                  imageUrl: "/static/img/error-icon.png"
                });
                return;
            }
            else {
                // all is ok, so delete the row on the interface
                if (data.comments.length != 0){
                    var message = '';
                    $.each(data.comments, function(){
                        message += sprintf('<p class="alert text-%s">%s</p>', this.type, this.message);
                    });
                    message = sprintf('<div class="alert alert-dismissable"><button aria-hidden="true" data-dismiss="alert" class="close" type="button">×</button>%s</div>', message);
                }
                else{
                    message = '<div class="alert alert-success alert-dismissable"><button aria-hidden="true" data-dismiss="alert" class="close" type="button">×</button>The mappings are valid. No warning/comments</div>';
                }
                $('#mapping_comments').html(message);
                if(data.is_fully_mapped && data.is_mapping_valid){
                    $('#dry_run').removeClass('disabled');
                }
                dash.is_mapping_valid = (data.is_mapping_valid == true) ? true : false;
            }
        }
    });
};

BadiliDash.prototype.initiateManageMappings = function(){
    this.initiateAllForms();
    this.initiateTablesCombo();
    this.refreshMappingsTable(dash.data.mappings);
};

BadiliDash.prototype.clearMappings = function(){
    dash.showLoadingSpinner('Please wait while we delete the mappings...');
    $.ajax({
        type: "POST", url: "/clear_mappings/", dataType: 'json',
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            $('#clearMappingsModal').modal('hide');
            if (data.error) {
                swal({
                  title: "Error!",
                  text: data.message,
                  imageUrl: "/static/img/error-icon.png"
                });
                return;
            } else {
                dash.showNotification('The mapping(s) were cleared successfully', 'success', true);
                dash.refreshMappingsTable(data.mappings);
            }
        }
    });
};

BadiliDash.prototype.executeDataProcessor = function(){
    dash.executeProcessingDryRun(false);
};

BadiliDash.prototype.executeProcessingDryRun = function(is_dry_run=true){
    if(dash.is_mapping_valid == false){
        dash.showNotification('Cowardly refusing to perform a dry ran since mapping validation has not been done/passed.', 'warning', true);
        return;
    }
    if(is_dry_run == false){
        if(dash.is_dry_run_passed == false){
            dash.showNotification('Cowardly refusing to process the data since the dry run has not been done/passed.', 'warning', true);
            $('#clearMappingsModal').modal('hide');
            $('#processMappingsModal').modal('hide');
            return;
        }
    }
    dash.showLoadingSpinner('Please wait while we test the dry run...');
    if(is_dry_run == false){
        $('#clearMappingsModal').modal('hide');
        $('#processMappingsModal').modal('hide');
    }
    $.ajax({
        type: "POST", url: "/manual_data_process/", dataType: 'json', data: {'is_dry_run': is_dry_run},
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            $('#clearMappingsModal').modal('hide');
            $('#processMappingsModal').modal('hide');

            if(data.comments.length != 0){
                message = dash.formatErrorMessages(data.comments);
                $('#mapping_comments').html(message);
            }
            else{
                $('#mapping_comments').html('');
            }
            if (data.error) {
                dash.showNotification('The data processing dry ran failed', 'error', true);
            } else {
                dash.showNotification('The data processing dry ran was successful', 'success', true);
                $('#process_data').removeClass('disabled');
            }
            dash.is_dry_run_passed = (data.error == false) ? true : false;
        }
    });
};

BadiliDash.prototype.clearProcessedData = function(){
    dash.showLoadingSpinner('Please wait while we clear the processed data...');
    $.ajax({
        type: "POST", url: "/delete_processed_data/", dataType: 'json',
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            $('#deleteDataModal').modal('hide');
            if (data.error) {
                message = dash.formatErrorMessages(data.comments);
                $('#mapping_comments').html(message);
                dash.showNotification('The data truncation process failed', 'error', true);
            } else {
                dash.showNotification('The processed data was deleted successfully!', 'success', true);
                $('#mapping_comments').html('');
            }
        }
    });
};

BadiliDash.prototype.formatErrorMessages = function(comments){
    if (comments.length != 0){
        var message = '';
        $.each(comments, function(i, i_message){
            message += sprintf('<p class="alert text-%s">%s</p>', 'danger', i_message);
        });
        message = sprintf('<div class="alert alert-dismissable"><button aria-hidden="true" data-dismiss="alert" class="close" type="button">×</button>%s</div>', message);
    }
    else{
        message = '<div class="alert alert-success alert-dismissable"><button aria-hidden="true" data-dismiss="alert" class="close" type="button">×</button>The mappings are valid. No warning/comments</div>';
    }
    return message;
};

BadiliDash.prototype.initiateProcessingErrorsPage = function(){
    dash.error_table = $('#processing_errors').dynatable({
      dataset: {
        paginate: true,
        recordCount: true,
        sorting: true,
        ajax: true,
        ajaxUrl: '/fetch_processing_errors/',
        ajaxOnLoad: true,
        records: []
      }
    });

    dash.initJSONEditor()
};

BadiliDash.prototype.viewRawSubmission = function(){
    var rec_id = $(this).data("identifier");
    dash.cur_error_id = rec_id;
    dash.showLoadingSpinner('Please wait while we fetch the raw submission...');
    $.ajax({
        type: "POST", url: "/fetch_single_error/", dataType: 'json', data: {'err_id': rec_id},
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            if (data.error) {
                dash.showNotification('The data truncation process failed', 'error', true);
            } else {
                dash.populateErrorInfo(data);
                dash.showNotification('The error message was loaded successfully!', 'success', true);
            }
        }
    });
};

BadiliDash.prototype.populateErrorInfo = function(data){
    // load the json data
    dash.renderJSON(data.raw_submission.raw_data);
    var resolved = undefined;
    if(data.err_json.is_resolved){
        resolved = '<button type="button" class="btn btn-success btn-sm">Yes</button>';
    }
    else{
        resolved = '<button type="button" class="btn btn-danger btn-sm">No</button>';
    }
    $('#is_resolved').html(resolved);
    $('#error_id').html(data.err_json.id);
    $('#error_code').html(data.err_json.err_code);
    $('.uuid').html(data.raw_submission.uuid);
    $('#subm_time').html(data.raw_submission.submission_time);
    $('#err_comments').html(data.err_json.err_comments);
    $('#err_message').html(data.err_json.err_message);
    $('#add_comments').html(data.err_json.err_comments);

    $('.processing_comments, .json_editor').removeClass('hidden');
};

BadiliDash.prototype.initJSONEditor = function(){
    // Set default options
    JSONEditor.defaults.options.theme = 'bootstrap2';

    // Initialize the editor
    dash.json_editor = new JSONEditor(document.getElementById("edit_raw_json"),{
      schema: {
          type: "object",
          properties: {
              name: { "type": "string" }
          }
      }
    });

    dash.json_editor.on('change',function() {
        // Get an array of errors from the validator
        var errors = dash.json_editor.validate();
        var indicator = document.getElementById('valid_indicator');
        
        // Not valid
        if(errors.length) {
            $('#valid_indicator').removeClass('alert-success').removeClass('alert-danger').addClass('alert-danger').text('Invalid Edits');
        }
        // Valid
        else {
            $('#valid_indicator').removeClass('alert-success').removeClass('alert-danger').addClass('alert-success').text('JSON Data is Valid');
        }
    });
};

BadiliDash.prototype.renderJSON = function(json_o){
    try {
        schema = JSON.parse(json_o);
    }
    catch(e) {
        dash.showNotification('Invalid JSON Schema: '+e.message, 'error', true);
        return;
    }
    dash.json_editor.setValue(JSON.parse(json_o));
};

BadiliDash.prototype.initiateMap = function(lat, lon, zoom, include_overlay = true){
    if (lat == undefined) {
        dash.map = L.map('leaflet_map', dash.default_zoom).setView([0.2934628,38.132656], 6);
    }
    else {
        dash.map = L.map('leaflet_map', dash.default_zoom).setView([lat, lon], zoom);
    }

    if(include_overlay){
        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
                '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
                'Imagery © <a href="http://mapbox.com">Mapbox</a>',
            id: 'mapbox.streets',
            detectRetina: false
        }).addTo(dash.map);
    }
};

BadiliDash.prototype.loadFirstLevel = function(c_code){
    dash.showLoadingSpinner('Please wait while we load the first level...');
    $.get('/first_level_geojson?c_code='+c_code, function(response){
        // console.log(response);
        dash.layersData = [];
        $.each(response, function(i, that){
            var n_layer = L.geoJSON(that.polygon, {style: dash.base_color, county_code: that.c_code}).addTo(dash.map);

            n_layer.on('mouseover', function(){
                setTimeout(function() { dash.updateInfoDiv(that); }, 200);
            });
            n_layer.on({click: function(){
                dash.showNotification('Pending functionality', 'error', true);
                // $('#spinnerModal').toggleClass('hidden');
                // window.location.href = '/view_county?code='+this.options.county_code;
            }});
            n_layer.on('mouseout', function(){
                dash.updateInfoDiv(None);
            });
        });
        dash.destroyLoadingSpinner();
    });
};

BadiliDash.prototype.updateInfoDiv = function(data){
    console.log(data);
};

BadiliDash.prototype.initiateMapVisualization = function(center_lat, center_lon, zoom_level){
    dash.initiateMap(center_lat, center_lon, zoom_level);

    // load the first level admin region
    dash.loadFirstLevel(54);
};

BadiliDash.prototype.saveEditedJson = function(){
    var edited_json = dash.json_editor.getValue();

    dash.showLoadingSpinner('Please wait while we save your changes...');
    $.ajax({
        type: "POST", url: "/save_json_edits/", dataType: 'json', data: {'err_id': dash.cur_error_id, 'json_data': JSON.stringify(edited_json)},
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            $('#saveRawDataEditsModal').modal('hide');
            if (data.error) {
                dash.showNotification('There was an error while saving the edits. Please contact the system administrator!', 'error', true);
            } else {
                dash.showNotification('The edits were saved successfully!', 'success', true);
            }
        }
    });
};

BadiliDash.prototype.processCurSubmission = function(){
    dash.showLoadingSpinner('Please wait while we process the submission..');
    $.ajax({
        type: "POST", url: "/process_single_submission/", dataType: 'json', data: {'err_id': dash.cur_error_id},
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            $('#processSingleSubmission').modal('hide');
            if (data.error) {
                var mssg = sprintf('There was an error while processing the submission.<br />%s<br />Please contact the system administrator!', data.message);
                dash.showNotification(mssg, 'error', true);
            } else {
                dash.json_editor.setValue({});
                dash.showNotification('The submission was processed successfully!', 'success', true);
            }
        }
    });
};

BadiliDash.prototype.initiateProcessingStatus = function(){
    dash.error_table = $('#processing_status').dynatable({
      dataset: {
        paginate: true,
        recordCount: true,
        sorting: true,
        ajax: true,
        ajaxUrl: '/fetch_processing_status/',
        ajaxOnLoad: true,
        records: []
      }
    });
};

BadiliDash.prototype.initiate_adgg_dash = function(){
    // Show the household head distribution by gender
    Highcharts.chart('farmers_gender_dist', {
        chart: {
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false,
            type: 'pie'
        },
        credits: {
            enabled: false
        },
        title: {
            text: null
        },
        tooltip: {
            pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: {
                    enabled: false
                },
                showInLegend: true
            }
        },
        series: [{
            name: 'Sex',
            colorByPoint: true,
            data: dash.data.farmers.by_gender
        }]
    });
    // Show the animal distribution by gender
    Highcharts.chart('animals_dist', {
        chart: {
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false,
            type: 'pie'
        },
        credits: {
            enabled: false
        },
        title: {
            text: null
        },
        tooltip: {
            pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: {
                    enabled: false
                },
                showInLegend: true
            }
        },
        series: [{
            name: 'Sex',
            colorByPoint: true,
            data: dash.data.animals.by_sex
        }]
    });
    // Show the processing status
    Highcharts.chart('farmer_reg_processing', {
        chart: {
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false,
            type: 'pie'
        },
        credits: {
            enabled: false
        },
        title: {
            text: 'Human Registrations'
        },
        tooltip: {
            pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: {
                    enabled: false
                },
                showInLegend: true
            }
        },
        series: [{
            name: 'Farmer Reg Processing',
            colorByPoint: true,
            data: dash.data.formgroups.processing_status.farmer_reg
        }]
    });
    // Show the processing status
    Highcharts.chart('animal_reg_processing', {
        chart: {
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false,
            type: 'pie'
        },
        credits: {
            enabled: false
        },
        title: {
            text: 'Animal Registrations'
        },
        tooltip: {
            pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: {
                    enabled: false
                },
                showInLegend: true
            }
        },
        series: [{
            name: 'Animal Reg Processing',
            colorByPoint: true,
            data: dash.data.formgroups.processing_status.animal_reg
        }]
    });
};

BadiliDash.prototype.initiateFormSettingsPage = function(){
    dash.error_table = $('#form_settings_table').dynatable({
      dataset: {
        paginate: true,
        recordCount: true,
        sorting: true,
        ajax: true,
        ajaxUrl: '/forms_settings_info/',
        ajaxOnLoad: true,
        records: []
      }
    });
};

BadiliDash.prototype.refreshODKFormsTable = function(data){
    // create the grid with the form details
    var $editor = $('#form-edit-modal');
    var ft;
    var columns = [
        {'name': 'form_id', 'title': 'ID', 'visible': false},
        {"name":"_selection", "title" : "Selection", 'visible': false, "sortable": false, "filterable":false},
        {"name":"_checkbox", "title" : "<input type='checkbox' class='global-checkbox'>", 'visible': true, "sortable": false, "filterable":false},
        {'name': 'form_group', 'title': 'Form Group'},
        {'name': 'form_name', 'title': 'Form Name'},
        {'name': 'full_form_id', 'title': 'Full Form ID'},
        {'name': 'auto_update', 'title': 'Auto Process'},
        {'name': 'is_source_deleted', 'title': 'Is Source Deleted'}
    ];

    if(dash.ft == undefined){
        dash.ft = FooTable.init('#form_settings_table', {
            columns: columns,
            rows: data,
            editing: {
                alwaysShow: true,
                editRow: function(row){
                    var values = row.val();
                    $editor.find('#form_id').val(values.mapping_id);
                    if (values.auto_update == true){
                        $editor.find('#auto_update_yes').prop('checked', true);
                    }
                    else{
                        $editor.find('#auto_update_no').prop('checked', true);
                    }
                    if (values.is_source_deleted == true){
                        $editor.find('#is_source_deleted_yes').prop('checked', true);
                    }
                    else{
                        $editor.find('#is_source_deleted_no').prop('checked', true);
                    }
                    $modal.data('row', row);
                    $editorTitle.text(sprintf('Editing the form settings for %s', values.form_name));
                    $modal.modal('show');
                },
                deleteRow: dash.deleteMapping
            }
        }),
        uid = 10001;
        $editor.on('submit', dash.submitMappingEdits);
    }
    else{
        dash.ft.rows.load(data);
    }
    if(data.length != 0){
        $('#test_mappings').removeClass('disabled');
        $('#clear_mappings').removeClass('disabled');
    }
};

BadiliDash.prototype.editFormSettings = function(){
    var form_id = $(this).data('form_id');
    dash.showLoadingSpinner('Please wait while we fetch the form details...');
    $.ajax({
        type: "POST", url: "/fetch_form_details/", dataType: 'json', data: {'form_id': form_id},
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            if (data.error) {
                dash.showNotification('There was an error while fetching form details.', 'error', true);
            } else {
                dash.populateFormDetails(data);
            }
        }
    });
};

BadiliDash.prototype.populateFormDetails = function(data){
    // create the select input item
    var form_group_input = "<select name='group_name'><option value='-1'>Select One\n";
    $.each(data.form_groups, function(){
        is_selected = (this.id == data.form_details.form_group) ? ' selected ' : '';
        form_group_input += "<option value='"+ this.id +"' "+ is_selected +"> "+ this.group_name +"\n";
    });
    form_group_input += "</select>"
    $('#form_group').html(form_group_input);
    $('[name=form_id]').val(data.form_details.form_id);
    $('#form_name').html(data.form_details.form_name);

    if(data.form_details.is_source_deleted == true){
        $('#is_source_deleted_yes').prop('checked', 'checked');
    }
    else{
        $('#is_source_deleted_no').prop('checked', 'checked');
    }

    if(data.form_details.auto_update == true){
        $('#auto_update_yes').prop('checked', 'checked');
    }
    else{
        $('#auto_update_no').prop('checked', 'checked');
    }

    $('#form-edit-modal').modal('show');
};

BadiliDash.prototype.saveFormSettings = function(event){
    event.preventDefault();
    // get all the settings
    var form_details = $('#form_details_editor').serializeArray();
    dash.showLoadingSpinner('Please wait while we save the form details...');
    $.ajax({
        type: "POST", url: "/save_form_details/", dataType: 'json', data: form_details,
        error: dash.communicationError,
        success: function (data) {
            dash.destroyLoadingSpinner();
            if (data.error) {
                dash.showNotification('There was an error while saving the form details.', 'error', true);
            } else {
                dash.refreshODKFormsTable(data.form_settings);
                dash.showNotification('The form details were saved successfully.', 'error', false);
                $('#form-edit-modal').modal('hide');
            }
        }
    });
};

BadiliDash.prototype.saveSystemSettings = function(event){
    event.preventDefault();
    console.log(this.id);
    if(this.id == 'save_sys_settings'){
        var cur_form_id = 'save_settings';
        $("#"+cur_form_id).validate({
            rules: {
                no_dry_ran_rec: {
                    required: true,
                    digits: true
                }
            }
        });
    }
    else if(this.id == 'save_db_settings'){
        var cur_form_id = 'destination_db';
        $("#"+cur_form_id).validate();
    }
    else if(this.id == 'save_ona_settings'){
        var cur_form_id = 'ona_api';
        $("#"+cur_form_id).validate();
    }
    var entered_data = $('#'+cur_form_id).serializeArray();
    
    if($("#"+cur_form_id).valid() == false){
        return;
    }

    // {'err_id': dash.cur_error_id, 'json_data': JSON.stringify(edited_json)
    $('#spinnermModal').modal('show');
    $.ajax({
        type: "POST", url: "/save_settings/", dataType: 'json', data: entered_data,
        error: dash.communicationError,
        success: function (data) {
            $('#spinnermModal').modal('hide');
            if (data.error) {
                dash.showNotification('There was an error while saving the edits. Please contact the system administrator!', 'error', true);
            } else {
                dash.showNotification('The edits were saved successfully!', 'success', true);
            }
        }
    });
};

BadiliDash.prototype.initiateFormGroupsSettings = function(){
    dash.error_table = $('#form_groups_table').dynatable({
      dataset: {
        paginate: true,
        recordCount: true,
        sorting: true,
        ajax: true,
        ajaxUrl: '/form_groups_info/',
        ajaxOnLoad: true,
        records: []
      },
      features: {
        search: false
      }
    });
};

BadiliDash.prototype.saveGroupDetails = function(){
    $("#form_group_editor").validate({
        rules: {
            group_name: {
                required: true
            },
            group_index: {
                required: true,
                digits: true
            }
        }
    });
    if($("#form_group_editor").valid() == false){
        return;
    }
    event.preventDefault();
    // get all the settings
    var group_details = $('#form_group_editor').serializeArray();
    $('#spinnermModal').modal('show');
    $.ajax({
        type: "POST", url: "/save_group_details/", dataType: 'json', data: group_details,
        error: dash.communicationError,
        success: function (data) {
            $('#spinnermModal').modal('hide');
            if (data.error) {
                dash.showNotification('There was an error while saving the group details.', 'error', true);
            } else {
                dash.refreshFormGroupsTable(data.group_settings);
                dash.showNotification('The group details were saved successfully.', 'error', false);
                $('#form-group-modal').modal('hide');
            }
        }
    });
};

BadiliDash.prototype.refreshFormGroupsTable = function(){};

BadiliDash.prototype.refreshViewData = function(){
    var view_id = $(this).data('identifier');

    event.preventDefault();
    console.log('Beginning');
    $('#spinnermModal').modal('show');
    $.ajax({
        type: "POST", url: "/refresh_view_data/", dataType: 'json', data: {'view_id': view_id},
        error: dash.communicationError,
        success: function (data) {
            console.log('End')
            $('#spinnermModal').modal('hide');
            if (data.error) {
                alert(data.message);
                dash.showNotification('There was an error while refreshing the view data.', 'error', true);
            } else {
                // dash.refreshFormGroupsTable(data.group_settings);
                alert(data.message);
                dash.showNotification('The views data was refreshed successfully.', 'error', false);
                // $('#form-group-modal').modal('hide');
            }
        }
    });
};

BadiliDash.prototype.showLoadingSpinner = function(loading_text='Loading...'){
    if (typeof $('body').loadingModal === "function") {
        $('body').loadingModal({
          position: 'auto',
          text: loading_text,
          color: '#fff',
          opacity: '0.7',
          backgroundColor: 'rgb(0,0,0)',
          animation: 'cubeGrid'
        });
    }
};

BadiliDash.prototype.destroyLoadingSpinner = function(){
    if (typeof $('body').loadingModal === "function") {
        $('body').loadingModal('destroy');
    }
};

// BUTTON ACTIONS MANAGEMENT
BadiliDash.prototype.initiateActionButtons = function(id_){
    dash.objects.cur_modal = id_;
    $('#'+id_).on('show.bs.modal', function (event) {
        var button = event.relatedTarget;
        dash.objects.cur_object = $(button).data('object_type');
        dash.objects.cur_action = $(button).data('action');
    });
};

BadiliDash.prototype.editObjects = function(event){
    var button = event.relatedTarget == null ? event.target : event.relatedTarget;
    dash.objects.cur_action = $(button).data('action');
    dash.objects.cur_object = $(button).data('object_type');
    dash.objects.cur_modal = undefined;

    // update the modal with what we are doing
    $('#newObject .modal-title').html(sprintf('%s a new %s', dash.objects.cur_action.toProperCase(), dash.objects.cur_object));
    $('#newObject .object_label').html(sprintf('%s name', dash.objects.cur_object.toProperCase()));
    $('#newObject .confirm_save').html(sprintf('Save %s', dash.objects.cur_object.toProperCase()));

    if(dash.objects.cur_action == 'edit'){
        dash.objects.cur_row = dash.objects.button_settings[dash.objects.cur_object]['table'].row('#'+$(button).data('row-id')).data();
        $('[name=object_name]').val(dash.objects.cur_row['name']);
    }
    else{
        $('[name=object_name]').val('');
    }

    dash.objects.cur_modal = 'newObject';
    $('#newObject').modal();
};

BadiliDash.prototype.initiateObjectManagement = function(){
    $('#confirmModal').on('show.bs.modal', function (event) {
        var button = event.relatedTarget;
        if(button != undefined){
            dash.objects.cur_object = $(button).data('object_type');
            dash.objects.cur_action = $(button).data('action');
            $('#confirm').data('object_id', $(button).data('row-id'));
            dash.objects.ajax_data = {'object_id': $(button).data('row-id')};
        }

        // change the modal message
        $('#modal_title').html('Confirm '+ dash.objects.cur_action +'!');
        if(dash.objects.button_settings[dash.objects.cur_object]['modal_message'] == undefined){
            var modal_message = 'Are you sure you want to <strong>'+ dash.objects.cur_action +'</strong> this <strong>'+ dash.objects.cur_object +'</strong>.';
        }
        else{
            var modal_message = dash.objects.button_settings[dash.objects.cur_object]['modal_message'];
        }
        
        if(dash.objects.cur_action == 'delete'){
            modal_message += ' This action is not reversible.';
        }

        if(dash.objects.button_settings[dash.objects.cur_object]['is_long_process']){
            modal_message += "<br /><br />This will take a few seconds as we save the changes and update the data collection app...";
        }

        $('#modal_message').html(modal_message);
        var confirm_caption = dash.objects.button_settings[dash.objects.cur_object]['confirm_btn_caption'] == undefined ? dash.objects.cur_action : dash.objects.button_settings[dash.objects.cur_object]['confirm_btn_caption'];
        $('#confirm').html(confirm_caption.toProperCase());

    });

    $('#confirm').on('click', function () {
        if(dash.objects.cur_object == 'elisa_results'){
            $('#'+dash.objects.button_settings[dash.objects.cur_object]['form']).submit();
            return true;
        }

        // formulate the url
        var url = '/' + dash.objects.cur_action + dash.objects.button_settings[dash.objects.cur_object]['url'];
        dash.objects.refresh_table = dash.objects.button_settings[dash.objects.cur_object]['table'];
        dash.showProcessing();
        ajax_type = dash.objects.button_settings[dash.objects.cur_object]['ajax_type'] == undefined ? "POST" : dash.objects.button_settings[dash.objects.cur_object]['ajax_type'];
        $.ajax({
            type: ajax_type, url: url, dataType: 'json', data: dash.objects.ajax_data,
            error: dash.communicationError,
            success: function (data) {
                dash.endShowProcessing();
                $('#confirmModal').modal('hide');
                $('.modal-backdrop').remove();
                $('.modal-backdrop').remove();
                if (data.error) {
                    if (typeof $.notify === "function"){ $.notify({message: data.message}, {type: 'danger'}); }
                    return;
                } else {
                    var message = data.message == undefined ? dash.objects.button_settings[dash.objects.cur_object]['success_message'] : data.message;
                    if (typeof $.notify === "function"){ $.notify({message: message}, {type: 'success'}); }
                    $('#'+dash.objects.cur_modal).modal('hide');
                    if(dash.objects.button_settings[dash.objects.cur_object]['redirect'] != undefined){
                        window.location = dash.objects.button_settings[dash.objects.cur_object]['redirect'];
                    }
                    // we might need to update the pre-requisite table
                    if(dash.objects.button_settings[dash.objects.cur_object]['table'] != undefined) { dash.objects.button_settings[dash.objects.cur_object]['table'].ajax.reload(); }
                    $('[name='+ dash.objects.button_settings[dash.objects.cur_object]['form'] +']').trigger("reset");
                    dash.objects.cur_action = undefined;
                }
            }
        });
    });
};

BadiliDash.prototype.confirmSave = function(event){
    form2validate = $('[name='+ dash.objects.button_settings[dash.objects.cur_object]['form'] +']');

    // dash.objects.newsch_validator = form2validate.validate();
    isValid = false;
    isValid = form2validate.valid();
    
    if( isValid ){
        dash.objects.refresh_table = dash.objects.button_settings[dash.objects.cur_object]['table'];
        
        // if we are editing, add the object id
        if(dash.objects.ajax_data == undefined) dash.objects.ajax_data = objectifyForm(form2validate.serializeArray());
        else dash.objects.ajax_data = $.merge( dash.objects.ajax_data, objectifyForm(form2validate.serializeArray()) );

        if(dash.objects.cur_action != undefined && dash.objects.cur_action != 'add'){
            if(dash.objects.ajax_data['object_id'] == undefined) dash.objects.ajax_data['object_id'] = dash.objects.cur_row['pk_id'];
        }
        $('#confirmModal').modal();
    }
    else{
        dash.objects.first_modal = undefined;
    }
};

BadiliDash.prototype.endShowProcessing = function(){
    $('#overlay, .cssload-loader').css('display', 'none');
};

BadiliDash.prototype.showProcessing = function(){
    $('#overlay, .cssload-loader').css('display', 'flex');
};

// END OF BUTTON ACTIONS MANAGEMENT

BadiliDash.prototype.initiateDataEditing = function(){
    var settings = {
      serviceUrl:'/submissions_search/', minChars:4, maxHeight:400, width:780,
      zIndex: 9999, deferRequestBy: 400, //miliseconds
      noCache: true, //default is false, set to true to disable caching
      onSelect: function (suggestion) {
        // $('#globalsearch').val(suggestion.data);
        dash.subm_id = suggestion.data;
        dash.loadRawSubmission(suggestion.data);
      }
   };
   // not working.... going around it FOR NOW
   $('#globalsearch').autocomplete(settings);
   // dash.loadRawSubmission(1948);
};

BadiliDash.prototype.loadRawSubmission = function(submission_id){
    // load a raw submission
    $('#spinnermModal').modal('show');
    $.ajax({
        type: "POST", url: `/raw_submission/`, dataType: 'json', data: {subm_id: submission_id},
        error: dash.communicationError,
        success: function (data) {
            $('#spinnermModal').modal('hide');
            if (data.error) {
                dash.showNotification('There was an error while loading the raw submission. Please contact the system administrator!', 'error', true);
            } else {
                // console.log(data);
                dash.json_data = data.submission;
                dash.raw_data = data.raw_submission;
                dash.renderJson();
            }
        }
    });
};

BadiliDash.prototype.renderJson = function() {
    var options = {
        collapsed: false,
        rootCollapsable: true,
        withQuotes: false,
        withLinks: true,
        bigNumbers: true
    };
    $('.editing').hide()
    $('#viewer').html(`<pre id="json-renderer" class='json-document'></pre>`);
    $('#json-renderer').jsonViewer(dash.json_data, options);
};

BadiliDash.prototype.showNodeValue = function(){
    $('#viewer').html(`<div class='form-group'><textarea id='json_editor'></textarea></div>`);
    $('#json_editor').val(JSON.stringify(dash.raw_data, null, 4));
    $('.editing').toggle();
};

BadiliDash.prototype.cancelEdits = function(){
    $('#viewer').html(`<pre id="json-renderer" class='json-document'></pre>`);
    dash.renderJson()
    $('.editing').toggle();
};

BadiliDash.prototype.saveChanges = function(){
    var data_changes = {
        'subm_id': dash.subm_id,
        'reprocess_data': $("input[type='radio'][name='reprocess']:checked").val(),
        'change_reason': $('#change_reason').val(),
        'new_json': $('#json_editor').val()
    };    

    dash.showProcessing();
    $.ajax({
        type: 'POST', url: '/submission_edits_save/', dataType: 'json', data: data_changes,
        error: function(){
            dash.endShowProcessing();
            $('#confirmModal').modal('hide');
            $('.modal-backdrop').remove();
            $('.modal-backdrop').remove();
            dash.showNotification('There was an error while saving the changes', 'error', true);
        },
        success: function (data) {
            dash.endShowProcessing();
            $('#confirmModal').modal('hide');
            $('.modal-backdrop').remove();
            $('.modal-backdrop').remove();
            if (data.error) {
                dash.showNotification('There was an error while saving the changes', 'error', true);
                return;
            } else {
                dash.showNotification('The RAW ODK data has been saved successfully!', 'success', true);
                dash.json_data = JSON.parse($('#json_editor').val());
                $('#change_reason').val('');
                dash.renderJson();
            }
        }
    });

};

var dash = new BadiliDash();

function objectifyForm(formArray) {
    //serialize data function
    var returnArray = {};
    for (var i = 0; i < formArray.length; i++){
        returnArray[formArray[i]['name']] = formArray[i]['value'];
    }
    return returnArray;
}

String.prototype.toProperCase = function () {
    return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};

$(document).on('click', '.nav-deep.badili-nav .nav-item', function(){
    $(this).find('ul').toggle(1000);
});
