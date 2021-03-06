define(
        ['jquery', 'underscore', 'underscore.string', 'pgadmin', 'pgadmin.browser', 'alertify', 'pgadmin.browser.collection', 'pgadmin.browser.node.ui', 'pgadmin.browser.server.privilege'],
function($, _, S, pgAdmin, pgBrowser, alertify) {

   var SecurityModel = Backform.SecurityModel = pgAdmin.Browser.Node.Model.extend({
    defaults: {
      provider: null,
      security_label: null
    },
    schema: [{
      id: 'provider', label: '{{ _('Provider') }}',
      type: 'text', disabled: false,
      cellHeaderClasses:'width_percent_50'
    },{
      id: 'security_label', label: '{{ _('Security Label') }}',
      type: 'text', disabled: false,
      cellHeaderClasses:'width_percent_50'
    }],
    validate: function() {
      var err = {},
          errmsg = null;

      if (_.isUndefined(this.get('security_label')) ||
        _.isNull(this.get('security_label')) ||
        String(this.get('security_label')).replace(/^\s+|\s+$/g, '') == '') {
            errmsg =  '{{ _('Please specify the value for all the security providers.')}}';
            this.errorModel.set('security_label', errmsg);
            return errmsg;
          } else {
            this.errorModel.unset('security_label');
          }
      return null;
    }
  });

  if (!pgBrowser.Nodes['coll-tablespace']) {
    var databases = pgAdmin.Browser.Nodes['coll-tablespace'] =
      pgAdmin.Browser.Collection.extend({
        node: 'tablespace',
        label: '{{ _('Tablespaces') }}',
        type: 'coll-tablespace',
        columns: ['name', 'spcuser', 'description']
      });
  };

  if (!pgBrowser.Nodes['tablespace']) {
    pgAdmin.Browser.Nodes['tablespace'] = pgAdmin.Browser.Node.extend({
      parent_type: 'server',
      type: 'tablespace',
      sqlAlterHelp: 'sql-altertablespace.html',
      sqlCreateHelp: 'sql-createtablespace.html',
      label: '{{ _('Tablespace') }}',
      hasSQL:  true,
      canDrop: true,
      hasDepends: true,
      Init: function() {
        /* Avoid mulitple registration of menus */
        if (this.initialized)
            return;

        this.initialized = true;

        pgBrowser.add_menus([{
          name: 'create_tablespace_on_server', node: 'server', module: this,
          applies: ['object', 'context'], callback: 'show_obj_properties',
          category: 'create', priority: 4, label: '{{ _('Tablespace...') }}',
          icon: 'wcTabIcon icon-tablespace', data: {action: 'create'},
          enable: 'can_create_tablespace'
        },{
          name: 'create_tablespace_on_coll', node: 'coll-tablespace', module: this,
          applies: ['object', 'context'], callback: 'show_obj_properties',
          category: 'create', priority: 4, label: '{{ _('Tablespace...') }}',
          icon: 'wcTabIcon pg-icon-tablespace', data: {action: 'create'},
          enable: 'can_create_tablespace'
        },{
          name: 'create_tablespace', node: 'tablespace', module: this,
          applies: ['object', 'context'], callback: 'show_obj_properties',
          category: 'create', priority: 4, label: '{{ _('Tablespace...') }}',
          icon: 'wcTabIcon pg-icon-tablespace', data: {action: 'create'},
          enable: 'can_create_tablespace'
        }
        ]);
      },
      can_create_tablespace: function(node, item) {
        var treeData = this.getTreeNodeHierarchy(item),
            server = treeData['server'];

        return server.connected && server.user.is_superuser;
      },
      model: pgAdmin.Browser.Node.Model.extend({
        defaults: {
          name: undefined,
          owner: undefined,
          comment: undefined,
          spclocation: undefined,
          spcoptions: [],
          spcacl: [],
          seclabels:[]
        },

        // Default values!
        initialize: function(attrs, args) {
          var isNew = (_.size(attrs) === 0);

          if (isNew) {
            var userInfo = pgBrowser.serverInfo[args.node_info.server._id].user;
            this.set({'spcuser': userInfo.name}, {silent: true});
          }
          pgAdmin.Browser.Node.Model.prototype.initialize.apply(this, arguments);
        },

        schema: [{
          id: 'name', label: '{{ _('Name') }}', cell: 'string',
          type: 'text'
        },{
          id: 'oid', label:'{{ _('OID') }}', cell: 'string',
          type: 'text', disabled: true, mode: ['properties']
        },{
          id: 'spclocation', label:'{{ _('Location') }}', cell: 'string',
          group: '{{ _('Definition') }}', type: 'text', mode: ['properties', 'edit','create'],
          disabled: function(m) {
            // To disabled it in edit mode,
            // We'll check if model is new if yes then disabled it
            return !m.isNew();
          }
        },{
          id: 'spcuser', label:'{{ _('Owner') }}', cell: 'string',
          type: 'text', control: 'node-list-by-name', node: 'role'
        },{
          id: 'acl', label: '{{ _('Privileges') }}', type: 'text',
          group: '{{ _('Security') }}', mode: ['properties'], disabled: true
        },{
          id: 'description', label:'{{ _('Comment') }}', cell: 'string',
          type: 'multiline'
        },{
          id: 'spcoptions', label: '{{ _('Parameters') }}', type: 'collection',
          group: "Parameters", control: 'variable-collection',
          model: pgAdmin.Browser.Node.VariableModel,
          mode: ['edit', 'create'], canAdd: true, canEdit: false,
          canDelete: true
         },{
          id: 'spcacl', label: '{{ _('Privileges') }}', type: 'collection',
          group: '{{ _('Security') }}', control: 'unique-col-collection',
          model: pgAdmin.Browser.Node.PrivilegeRoleModel.extend({privileges: ['C']}),
          mode: ['edit', 'create'], canAdd: true, canDelete: true,
          uniqueCol : ['grantee'],
          columns: ['grantee', 'grantor', 'privileges']
         },{
          id: 'seclabels', label: '{{ _('Security Labels') }}',
          model: SecurityModel, editable: false, type: 'collection',
          group: '{{ _('Security') }}', mode: ['edit', 'create'],
          min_version: 90200, canAdd: true,
          canEdit: false, canDelete: true, control: 'unique-col-collection'
        }
        ],
        validate: function() {
          var err = {},
            errmsg = null,
            changedAttrs = this.sessAttrs,
            msg = undefined;
          if (_.has(changedAttrs, 'name') &&
                (_.isUndefined(this.get('name'))
              || String(this.get('name')).replace(/^\s+|\s+$/g, '') == '')) {
            msg = '{{ _('Name can not be empty!') }}';
            this.errorModel.set('name', msg);
          } else if (_.has(changedAttrs, 'spclocation') &&
                (_.isUndefined(this.get('spclocation'))
              || String(this.get('spclocation')).replace(/^\s+|\s+$/g, '') == '')) {
            msg = '{{ _('Location can not be empty!') }}';
            this.errorModel.set('spclocation', msg);
          } else {
            this.errorModel.unset('name');
            this.errorModel.unset('spclocation');
          }
          return null;
        }
      })
  });

  }

  return pgBrowser.Nodes['coll-tablespace'];
});
