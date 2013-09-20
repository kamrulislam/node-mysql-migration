/*
 * BaseModel
 * https://github.com/kamrulislam/node-mysql-migration/lib/MigrationModel.js
 *
 * Copyright (c) 2013 Md Kamrul Islam
 * Licensed under the MIT license.
 */

var model = require("../models/BaseModel"),
	connection = require('../config/connect_mysql.js');

var MigrationModel	= model.extend({
	table_name : 'schema_migrations',
	init: function(fn) {
		var sql = "CREATE TABLE IF NOT EXISTS ?? ( \
					  `version` varchar(15) NOT NULL DEFAULT '', \
					  PRIMARY KEY (`version`) \
					) ENGINE=InnoDB DEFAULT CHARSET=latin1;";
		connection.query(sql, this.table_name, function(err, result){
			if (err) {
				console.log('error when creating schema_migrations: ', err);
				if (fn) {
					fn(new Error(err)); 
				}
			} else {
				if (fn) {
					fn(null, result);
				}
			}
		});
	},

	generate: function() {
		if (process.argv.length > 3 ) {
			this.init(function (err, result) { // ensure schema migration table is there
				if (!err) {
					// create a file 
					var fs = require('fs');
					var moment = require('moment');
					var prefix = moment().format('YYYYMMDDHHmmss');
					var class_name = process.argv[3]; // TODO: valid class name should be there 
					var file_name = './files/' + prefix + '_' + class_name + '.js';
					fs.open(file_name, 'w', function(err, fd) {
						if (!err) {
							// write in the file
							fs.readFile('migration_template.txt', 'utf8',function (err, data) {
								if (err) throw err;
									var ob = {class_name : class_name};
									function replacer(match, p1, offset, string){
									  console.log(ob[p1]);
									  return ob[p1];
									};
									data = data.replace(/\{\{(\w+)\}\}/, replacer);
									fs.writeFile(file_name, data, function(err){
										if (err) throw err;
								});
								// close file stream to ensure file has been written	
								fs.close(fd, function (err){
									if (err) throw err;
									console.log("Created Migration Class " + file_name);
									process.exit(0);
								});
							});
							
						}
					});

				}
			});
		} else {
			console.log ('plesae enter a class name');
		}
	},
	numberOfMigrationNeeded: function (files, current_version, terget_version) {
		console.log(files, current_version, terget_version);

		var current_position = -1,
			migration_needed = 0,
			target_position = -2;

		for (var i = 0 ; i < files.length; i++) {
			if (files[i].match(/^(\d+)/)[0] == current_version)
				current_position = i;
			if (files[i].match(/^(\d+)/)[0] == terget_version)
				target_position = i;
		}
		if ((new RegExp(/^[+|-](\d+)/)).test(terget_version)) {
			target_position = current_position + parseInt(terget_version);
		} 

		if (target_position == -2){
			console.log ('Your target version is not found...'); process.exit(1);
		} else {
			migration_needed = target_position - current_position;
		}

		console.log(current_position, migration_needed); 
		return {current_position : current_position, migration_needed : migration_needed};
	},

	migrateUP: function (files, current, more) {
		// include files ...
		if ( current + 1 < files.length ) {
			var migration_script = require('./files/' + files[current + 1]);
			var version = files[current + 1].match(/^(\d+)/)[0];
			var class_name = (files[current + 1].substring(version.length+1)).split('.');
			class_name.pop();
			class_name = class_name.join('.');
			var context = this;
			migration_script[class_name].up(function (err, result){
				if (err) throw err;
				else {
					// upgrade successfule, so update the schema
					var sql = "INSERT INTO ?? SET ?";
					var data = {version: version};
					connection.query(sql, [context.table_name, data], function(err, result){
						if (err) {console.log ('Failed to update version '+ version); throw err;}
						else {
							console.log ('Update to version '+ version + ' is successful'); 

							if(more > 1) {
								context.migrateUP(files, ++current, --more);
								
							} else {
								process.exit(0);
							}
						}
					});
				}
			});
		} else {
			process.exit(0);
		}			
	},

	migrateDOWN: function (files, current, more) {
		// include files ...
		if (current >= 0) {
			var migration_script = require('./files/' + files[current]);
			var version = files[current].match(/^(\d+)/)[0];
			var class_name = (files[current].substring(version.length+1)).split('.');
			class_name.pop();
			class_name = class_name.join('.');
			var context = this;
			migration_script[class_name].down(function (err, result){
				if (err) throw err;
				else {
					// upgrade successfule, so update the schema
					var sql = "DELETE FROM ?? WHERE version = ?";
					var data = version;
					connection.query(sql, [context.table_name, data], function(err, result){
						if (err) {console.log ('Failed to update version '+ version); throw err;}
						else {
							console.log ('Moving down for version '+ version + ' is successful'); 

							if(++more < 0) {
								context.migrateDOWN(files, --current, more);
								
							} else {
								process.exit(0);
							}
						}
					});
				}
			});			
		} else {
			process.exit(0);
		}
	},	

	migrate: function () {
		if (process.argv.length > 3) {
			var version = process.argv[3];
			if ((new RegExp(/^\d{14}/)).test(version)) { // version should be a 14 digit number
				// read migration files
				var fs = require ('fs');
				var context = this;
				fs.readdir('./files/', function (err, files) {
					if (err) throw err;
					else {
						// TODO: sort files array

						var matched_files = [];
						for (var i = 0; i < files.length ; i++) {
							if (files[i].match(/^(\d+)/)[0]  == version) { // matched file name 
								matched_files.push (files[i]);
							}
						}
						if (matched_files.length == 0) {
							console.log ('No migration script found with that version.'); process.exit(1);
						} else if (matched_files.lenght > 1) {
							console.log ('Found more that one files with same version, please make one file per version.'); process.exit(1);
						} else { // target version file exists
							// find out latest version in db
							context.version (function (err, result) {
								if (err) throw err;
									// how many migration needed 
									var todo_migration = context.numberOfMigrationNeeded(files, result[0].version, version);
									if (todo_migration.migration_needed > 0) {
										// move up
										console.log("Moving UP ...");
										context.migrateUP (files, todo_migration.current_position, todo_migration.migration_needed);

									} else if (todo_migration.migration_needed < 0) {
										// move down
										console.log ("Moving Down ...");
										context.migrateDOWN (files, todo_migration.current_position, todo_migration.migration_needed);
									} else {
										// no migration needed
										console.log ("no migration needed");
									}

							});
						}
					}
				});

			} else if ((new RegExp(/^[+|-](\d+)/)).test(version)) {
				// migration number provided
				// read migration files
				var fs = require ('fs');
				var context = this;
				fs.readdir('./files/', function (err, files) {
					if (err) throw err;
					else {
						// find out latest version in db
						context.version (function (err, result) {
							if (err) throw err;
							// how many migration needed 
							var todo_migration = context.numberOfMigrationNeeded(files, result[0].version, version);
							if (todo_migration.migration_needed > 0) {
								// move up
								console.log("Moving UP ...");
								context.migrateUP (files, todo_migration.current_position, todo_migration.migration_needed);

							} else if (todo_migration.migration_needed < 0) {
								// move down
								console.log ("Moving Down ...");
								context.migrateDOWN (files, todo_migration.current_position, todo_migration.migration_needed);
							} else {
								// no migration needed
								console.log ("no migration needed");
							}

						});
					}
				});				
			}	else {
				console.log ('Please enter a correct format for version, it should be the start (YYYYMMDDHHmmss)-part of the file');
				process.exit(1);
			}

		} else {
			console.log ('Plese enter the version you want to migrate.');
		}
	},

	version: function (fn) {
		var sql = "SELECT max(??) version FROM ??";
		connection.query(sql, ['version', this.table_name], fn);
	},

	getVersion: function () {
		this.version(function (err, result){
			if (err) {
				throw err;
			} else {
				if (result[0].version) {
					console.log ('Current migration is upto : ', result[0].version);
				} else {
					console.log ("No migration yet");
				}
			}
			process.exit(0);
		});
	},

	run: function () {
		if (process.argv.length > 2) {
			switch (process.argv [2]) {
				case 'version' : 
					// jsut show the latest updated version
					this.getVersion();
					break;
				case 'generate' :
					// generate migration file
					this.generate();
					break;
				case 'migrate' :
					this.migrate();
					break;
				case 'help' :
					console.log ("Welcome to LeapLabs migration module. \
						\n \
						\n\tnode dbmigrate <option> [parameters] \
						\n \
						\nOPTION: Use Following options \
						\n------- \
						\nhelp         Shows different options. \
						\ngenerate     Generates a stub for migration file. It takes class_name as parameter. \
						\nversion      Shows last updated version. \
						\nmigrate      Takes a parameter of the version id (YYYYMMDDHHnnss) or simply (/^[+|-](d+)/). It then migrates up/down based on current migration. \
						");
					break;	
				default:
					console.log ("Option not found...");
					break;	
			} 
		} else {
			console.log ("Have you forgot to put an option? \nPlease use `node dbmigrate help` for options.");
		}
	}


});

module.exports = MigrationModel;