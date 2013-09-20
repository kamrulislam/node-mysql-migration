var _ 			= require("underscore"),
	connection 	= require('../config/connect_mysql.js');

module.exports = {
	table_name: 'users', // base table is defined as users table  
	extend: function(child) {
		return _.extend({}, this, child);
	},
	
	insert: function(data, fn) {
		var table_name = this.table_name;
		connection.query('INSERT INTO ?? SET ?', [this.table_name, data], function(err, result){
			if (err) {
				console.log('Failed to insert ', err);
				fn(new Error('Failed to insert' + err));
			} else {
				fn(null, result);return;
			}
		});
	},

	delete: function(data, fn) {
		connection.query('DELETE FROM ?? WHERE id = ?' , [ this.table_name, data.id] , function(err, result){
			if (err) {
				console.log('Failed to delete ', err);
				fn(new Error('Failed to delete' + err));
			} else {
				console.log(result);
				fn(null, result);
			}
		});
	}
}