/*
 * 
 * 初始化时，如果multSelect设置为false，但val设置了多个，则保留最后一个项目
 */
!function($) {
	//TODO 表格中的项目改为不要换行
	//TODO 如果组件可以多选并且已经选择了多个项目，则点击列表后，应该先进入“已选的项目”界面，方便用户查看和维护现有选择项
	//TODO 显示列表时，如果列表中显示的项目已经在控件中提到了（id列表中存在正在显示的项目），则该项目前面的单选复选按钮默认应该为选中状态
	var DatadictPicker = function(element, options) {
		var that = this;

		this.element = $(element);

		this.dataPickerApiUrl = options.dataPickerApiUrl || this.element.data('datadict-api-url') || "";
		this.dialogTitle = options.dialogTitle || this.element.data('datadict-dialog-title') || "选择";
		this.tabHeadName = options.tabHeadName || this.element.data('datadict-tab-head-name') || ['名称'];
		this.tabField = options.tabField || this.element.data('datadict-tab-field') || ['name'];
		this.multSelect = options.multSelect || this.element.data('datadict-mult-select') || false;
		this.hasSearch = options.hasSearch || this.element.data('datadict-has-search') || false;
		this.itemIdName = options.itemIdName || this.element.data("datadict-item-id-name") || "id";
		this.itemDisplayName = options.itemDisplayName || this.element.data("datadict-item-display-name") || "title";
		
		if(!$.isArray(this.tabHeadName))
			this.tabHeadName = this.tabHeadName.split(',');
		if(!$.isArray(this.tabField))
			this.tabField = this.tabField.split(',');

		this._dataId = null;
		this._dataDisplay = "";
		this._eleValId = null;
		this._eleDisId = null;
		this._selectedObj= [];
		this._page_pager=1;
		this._page_total=1;

		
		this.isInline = false;
		this.isVisible = false;
		this.isInput = this.element.is('input');
		this.bootcssVer = this.isInput ? (this.element.is('.form-control') ? 3
				: 2) : (this.bootcssVer = this.element.is('.input-group') ? 3
				: 2);

		this.component = this.element.is('.datadict-picker') ? (this.bootcssVer == 3 ? this.element
				.find(
						'.input-group-addon .glyphicon-book,.input-group-addon .glyphicon-bookmark,.input-group-addon .glyphicon-briefcase,.input-group-addon .glyphicon-file,.input-group-addon .glyphicon-filter,.input-group-addon .glyphicon-folder-close,.input-group-addon .glyphicon-folder-open,.input-group-addon .glyphicon-list,.input-group-addon .glyphicon-list-alt,.input-group-addon .glyphicon-plus,.input-group-addon .glyphicon-plus-sign,.input-group-addon .glyphicon-tag,.input-group-addon .glyphicon-tags,.input-group-addon .glyphicon-tasks,.input-group-addon .glyphicon-th,.input-group-addon .glyphicon-th-large,.input-group-addon .glyphicon-th-list')
				.parent()
				: this.element
						.find(
								'.add-on .icon-th, .add-on .icon-th-large, .add-on .icon-th-list, .add-on .icon-list-alt, .add-on .icon-tag, .add-on .icon-tags, .add-on .icon-book, .add-on .icon-bookmark, .add-on .icon-plus, .add-on .icon-folder-close, .add-on .icon-folder-open, .add-on .icon-tasks, .add-on .icon-filter, .add-on .icon-briefcase')
						.parent())
				: false;
		this.componentReset = this.element.is('.datadict-picker') ? (this.bootcssVer == 3 ? this.element
				.find('.input-group-addon .glyphicon-remove').parent()
				: this.element.find('.add-on .icon-remove').parent())
				: false;
		this.hasInput = this.component && this.element.find('input').length;
		if (this.component && this.component.length === 0) {
			this.component = false;
		}
		this._attachEvents();
		
		var tmp = [];
		tmp.push('<th class="datadict-picker-tab-col-selector text-center">选择</th>');
		$.each(this.tabHeadName,function(i,n) {
			tmp.push("<th>"+n+"</th>");
		});
		this._tabframe = '<table width="100%"  class="table table-bordered table-hover table-condensed"><thead><tr>'+tmp.join("")+'</tr></thead><tbody></tbody></table>';
		
		tmp = [];
		tmp.push('<tr><td class="selector"><input type="'+(this.multSelect?'checkbox':'radio')+'" value="${itemId}" data-display="${itemDisplay}" name="selector-'+this._eleValId+'" /></td>');
		$.each(this.tabField, function(i,n) {
			tmp.push("<td>${"+n+"}</td>");
		});
		tmp.push("</tr>");
		//alert(tmp.join(""));
		
		this._tabRowTemp = tmp.join("");
		
		
		this.picker = $(((this.bootcssVer == 3) ? PLUGIN_DATA.modelTemplateV3 : PLUGIN_DATA.modelTemplate)
				.replace(/\$\{id\}/g,this._eleValId).replace(/\$\{title\}/g,this.dialogTitle).replace(/\$\{body\}/g,this._tabframe))
		.appendTo(this.isInline ? this.element : 'body')
		.on({
			click:     $.proxy(this.click, this),
			mousedown: $.proxy(this.mousedown, this)
		});
		var dialog = $("#datadictpicker-dialog-"+this._eleValId);
		dialog.find("#searchButton").click($.proxy(this._search, this));
		dialog.find("#searchInput").keypress($.proxy(this._searchKeyPress, this));
		dialog.find("#btnPagerFirst").click($.proxy(this._pageFirst, this));
		dialog.find("#btnPagerBackward").click($.proxy(this._pageBackward, this));
		dialog.find("#btnPagerForward").click($.proxy(this._pageForward, this));
		dialog.find("#btnPagerEnd").click($.proxy(this._pageEnd, this));
		dialog.find("#pager").keypress($.proxy(this._pagerKeyPress, this));
		dialog.find("#btnSelect").click($.proxy(this._selectOk, this));
		if(this.hasSearch)
			dialog.find("#searchPanel").show();
		else
			dialog.find("#searchPanel").hide();
		
		this._loadInitData();
	};

	DatadictPicker.prototype = {
		constructor : DatadictPicker,

		_events : [],
		
		_attachEvents : function() {
			this._detachEvents();
			if (this.isInput) { // single input
				this._prepearInput(this.element);
				
				this._events = [ [ this.element, {
					focus : $.proxy(this.show, this),
					keyup : $.proxy(this.update, this),
					keydown : $.proxy(this.keydown, this)
				} ] ];
			} else if (this.component && this.hasInput) { // component:
				this._prepearInput(this.element.find('input'));
				
				this._events = [
				// For components that are not readonly, allow keyboard nav
				[ this.element.find('input'), {
					focus : $.proxy(this.show, this),
					keyup : $.proxy(this.update, this),
					keydown : $.proxy(this.keydown, this)
				} ], [ this.component, {
					click : $.proxy(this.show, this)
				} ] ];
				if (this.componentReset) {
					this._events.push([ this.componentReset, {
						click : $.proxy(this.reset, this)
					} ]);
				}
			} else if (this.element.is('div')) { // inline datetimepicker
				this.isInline = true;
			} else {
				this._events = [ [ this.element, {
					click : $.proxy(this.show, this)
				} ] ];
			}
			for ( var i = 0, el, ev; i < this._events.length; i++) {
				el = this._events[i][0];
				ev = this._events[i][1];
				el.on(ev);
			}
		},
		_detachEvents: function () {
			for (var i = 0, el, ev; i < this._events.length; i++) {
				el = this._events[i][0];
				ev = this._events[i][1];
				el.off(ev);
			}
			this._events = [];
		},
		_prepearInput: function(element) {
			// 将现有的input替换为hidden，然后新建一个用于显示的input
			
			this._eleValId = element.attr("id");
			this._eleDisId = element.attr("id")+"_display";
			var name = element.attr("name"); 
			var val = element.val();
			
			element.attr({"id":this._eleValId+"_display","readonly":"readonly","disabled":"disabled"});
			element.removeAttr("name");
			element.before("<input type='hidden' id='"+this._eleValId+"' name='"+name+"' value='"+val+"' />");
		},
		show: function() {
			//初始化数据
			this._selectedObj=[];
			$('#datadictpicker-dialog-'+this._eleValId).find("#searchInput").val("");
			this._page_pager=1;
			this._page_total=1;
			
			$('#datadictpicker-dialog-'+this._eleValId).modal();
			this.loadData();
		},
		update: function() {
			//TODO 如果是单个文本框，在用户输入完成后，调用api查询可能的项目并显示出来（类似于自动完成）
			
		},
		keydown: function() {
			//TODO
			
		},
		reset: function() {
			//将控件置空
			this._selectedObj=[];
			
			$("#"+this._eleValId).val("");
			$("#"+this._eleDisId).val("");
		},
		click: function() {
			//TODO
			
		},
		mousedown: function() {
			//TODO
			
		},
		loadData: function() {
			var tmp = this._tabRowTemp;
			var tabMode = $('#datadictpicker-dialog-'+this._eleValId).find("table").find("tbody");
			var tabField = this.tabField;
			var itemIdName = this.itemIdName;
			var itemDisplayName = this.itemDisplayName;
			var keyword = $('#datadictpicker-dialog-'+this._eleValId).find("#searchInput").val();
			var that = this;
			$.ajax({
				type: "POST",
				url: this.dataPickerApiUrl,
				data: {
					currentpage: this._page_pager,
					keyword: keyword 
				},
				success: function(html) {
					tabMode.empty();
					var json = $.parseJSON(html);
					$.each(json.dataList, function(i,n){
						var tt = tmp;
						$.each(tabField, function(ii, nn){
							var str = n[nn];
							if(!str)
								str = "";
							tt = tt.replace("${"+nn+"}", str);
						});
						tt = tt.replace("${itemId}", n[itemIdName]);
						tt = tt.replace("${itemDisplay}", n[itemDisplayName]);
						tabMode.append(tt);
					});
					//表格中的选择控件可以选择数据
					//点击表格行可以选择数据
					tabMode.find("tr").click(function(e){
						tabMode.find(":radio").removeAttr("checked");
						var input = $(this).find("input")
						if(input.attr("type")=="radio") {
							input.attr("checked","checked");
						}else{
							if(input.attr("checked"))
								input.removeAttr("checked");
							else
								input.attr("checked","checked");
						}
						
						$.proxy(that._updateData(), that);
					});
					//阻断input元素上的点击事件提升到tr去处理
					tabMode.find("tr input").click(function(e){
						$.proxy(that._updateData(), that);
						e.stopPropagation();
					});
					
					// 更新本地的页面信息
					that._page_total = json.pageCount>0?json.pageCount:1;
					that._page_pager = json.currentPage>that._page_total?that._page_total:json.currentPage;
					
					that._updatePagerUI();
				}
			});
		},
		_loadInitData: function() {
			// 初始化界面中提供的默认值，并调用api将这个值转换为可供显示的值
			// 如，在初始化之前，控件中保存了一个id值叫做11，api接口返回“中文名字”，则初始化之后，界面中的控件中显示的是“中文名字”这个值；
			// 同时，隐藏域中保存了11这个值
			var inpVal = $("#"+this._eleValId);
			var inpDis = $("#"+this._eleDisId);
			var that = this;
			if(inpVal.val())
				$.ajax({
					type: "POST",
					url: this.dataPickerApiUrl,
					data: {
						ids:  inpVal.val()
					},
					success: function(html) {
						var json = $.parseJSON(html);
						var val = "";
						var dis = "";
						$.each(json.dataList, function(i,n){
							if(that.multSelect) {
								val += (val==""?"":",")+n[that.itemIdName];
								dis += (dis==""?"":",")+n[that.itemDisplayName];
							}else{
								val = n[that.itemIdName];
								dis = n[that.itemDisplayName];
							}
						});
						
						inpVal.val(val);
						inpDis.val(dis);
					}
				});
		},
		_search: function() {
			this._page_pager = 1;
			this.loadData();
		},
		_pageFirst: function() {
			var old = this._page_pager;
			this._page_pager = 1;
			this._updatePagerUI();
			if(old!=this._page_pager)
				this.loadData();
		},
		_pageBackward: function() {
			var old = this._page_pager;
			this._page_pager-=1;
			if(this._page_pager<=0)
				this._page_pager = 1;
			this._updatePagerUI();
			if(old!=this._page_pager)
				this.loadData();
		},
		_pageForward: function() {
			var old = this._page_pager;
			this._page_pager+=1;
			if(this._page_pager>this._page_total)
				this._page_pager = this._page_total;
			this._updatePagerUI();
			if(old!=this._page_pager)
				this.loadData();
		},
		_pageEnd: function() {
			var old = this._page_pager;
			this._page_pager = this._page_total;
			this._updatePagerUI();
			if(old!=this._page_pager)
				this.loadData();
		},
		_searchKeyPress: function(e) {
			if(e.which==13) {
				this._search();
			}
		},
		_pagerKeyPress: function(e) {
			if(e.which==13) {
				var old = this._page_pager;
				
				this._page_pager = $("#datadictpicker-dialog-"+this._eleValId).find("#pager").val();
				
				if(this._page_pager>this._page_total)
					this._page_pager = this._page_total;
				this._updatePagerUI();
				if(old!=this._page_pager)
					this.loadData();
			}
		},
		_updatePagerUI: function() {
			if(this._page_total<=0)
				this._page_total=1;
			if(this._page_pager<=0)
				this._page_pager=1;
			if(this._page_pager>this._page_total)
				this._page_pager = this._page_total;
			
			var mod = $('#datadictpicker-dialog-'+this._eleValId);
			mod.find("#pager").val(this._page_pager);
			mod.find("#pagerTotal").html(this._page_total);
		},
		_updateData: function() {
			// 根据界面更新选中的数据（应该可以翻页）
			
			var that = this;
			var mod = $('#datadictpicker-dialog-'+this._eleValId);
			$.each(mod.find("table tbody input"), function(i, n) {
				var input = $(n);
				var type = $(n).attr("type");
				if(type=="radio") {
					if(input.attr("checked"))
						that._selectedObj = [{id:input.val(),display:input.data("display")}];
				}else{
					
					if(input.attr("checked")) {
						var data = {id:input.val(),display:input.data("display")};
						that._selectedObj = $.grep(that._selectedObj, function(n,i){
							return data.id==n.id;
						}, true);
						
						that._selectedObj.push(data);

						
					}else{
						that._selectedObj = $.grep(that._selectedObj, function(n,i){
							return input.val()==n.id;
						}, true);
					}
				}
			});
		},
		_selectOk: function() {
			//点击“选择”按钮后将数据放到表单中
			var val = "";
			var dis = "";
			$.each(this._selectedObj, function(i,n){
				val += (val==""?"":",")+n.id;
				dis += (dis==""?"":",")+n.display;
			});
			
			$("#"+this._eleValId).val(val);
			$("#"+this._eleDisId).val(dis);
			
			$('#datadictpicker-dialog-'+this._eleValId).modal('hide');
		}
	};
	
	$.fn.DatadictPicker = function(option) {
		var args = Array.apply(null, arguments);
		args.shift();
		return this.each(function () {
			var $this = $(this),
				data = $this.data('datadictpicker'),
				options = typeof option == 'object' && option;
			if (!data) {
				$this.data('datadictpicker', (data = new DatadictPicker(this, $.extend({}, $.fn.DatadictPicker.defaults, options))));
			}
			if (typeof option == 'string' && typeof data[option] == 'function') {
				data[option].apply(data, args);
			}
		});
	};
	$.fn.DatadictPicker.defaults = {
	};
	$.fn.DatadictPicker.Constructor = DatadictPicker;
	
	var PLUGIN_DATA = {
		modelTemplateV3: '<div class="modal fade datadictpicker-modal-v3" tabindex="-1" role="dialog" aria-labelledby="modal-title-${id}" aria-hidden="true" id="datadictpicker-dialog-${id}">'+
		'  <div class="modal-dialog">'+
		'    <div class="modal-content">'+
		'      <div class="modal-header">'+
		'        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>'+
		'        <h4 class="modal-title" id="modal-title-${id}">${title}</h4>'+
		'      </div>'+
		'      <div class="modal-body">${body}</div>'+
		'      <div class="modal-footer">'+
		'<div class="form-inline">'+
'	<div class="form-inline input-group-sm" id="searchPanel">'+
'		<span class="form-group search-input"><span class="input-group">'+
'			<input type="text" id="searchInput" class="form-control">'+
'				<span class="input-group-btn">'+
'					<button class="btn btn-default" type="button" id="searchButton"><i class="glyphicon glyphicon-search"> </i></button>'+
'				</span>'+
'			</span>'+
'		</span>'+
'		<span class="form-group pager-input"><span class="input-group">'+
'			<div class="input-group-btn">'+
'				<button id="btnPagerFirst" class="btn btn-default"><i class="glyphicon glyphicon-fast-backward"> </i></button>'+
'				<button id="btnPagerBackward" class="btn btn-default"><i class="glyphicon glyphicon-backward"> </i></button>'+
'			</div>'+
'			<input id="pager" class="form-control" type="text" value="1" style="width:45px;" />'+
'			<span id="pagerTotal" class="input-group-addon">1000</span>'+
'			<div class="input-group-btn">'+
'				<button id="btnPagerForward" class="btn btn-default"><i class="glyphicon glyphicon-forward"> </i></button>'+
'				<button id="btnPagerEnd" class="btn btn-default"><i class="glyphicon glyphicon-fast-forward"> </i></button>'+
'			</div>'+
'			</span>'+
'		</span>'+
'	</div>'+
'</div>'+
		'        <button type="button" id="btnClose" class="btn btn-default" data-dismiss="modal">关闭</button>'+
		'        <button type="button" id="btnSelect" class="btn btn-primary">选择</button>'+
		'      </div>'+
		'    </div>'+
		'  </div>'+
		'</div>',//FIXME for V3的模板翻页按钮有问题
		modelTemplate: '<div class="modal hide fade datadictpicker-modal" id="datadictpicker-dialog-${id}">'+
		'<div class="modal-header">'+
		'<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>'+
		'<h4>${title}</h4>'+
		'</div>'+
		'<div class="modal-body">${body}</div>'+
		'<div class="modal-footer">'+
		'<div class="form-search">'+
		'<div class="input-append" id="searchPanel">'+
		'<input type="text" id="searchInput" class="span2 search-query">'+
		'<button class="btn" id="searchButton"><i class="icon-search"> </i></button>'+
		'</div>&nbsp;'+
		'<div class="input-prepend input-append">'+
		'<div class="btn-group"><button id="btnPagerFirst" class="btn"><i class="icon-fast-backward"> </i></button>'+
		'<button id="btnPagerBackward" class="btn"><i class="icon-backward"> </i></button></div>'+
		'<input id="pager" type="text" value="1" style="width:35px;" />'+
		'<span id="pagerTotal" class="add-on pager-total">1</span>'+
		'<div class="btn-group"><button id="btnPagerForward" class="btn"><i class="icon-forward"> </i></button>'+
		'<button id="btnPagerEnd" class="btn"><i class="icon-fast-forward"> </i></button></div>'+
		'</div>'+
		'</div>'+
		'<button type="button" id="btnClose" class="btn" data-dismiss="modal" aria-hidden="true">关闭</button>'+
		'<button type="button" id="btnSelect" class="btn btn-primary">选择</button>'+
		'</div>'+
		'</div>'
	};
}(window.jQuery);