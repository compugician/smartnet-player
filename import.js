var mkdirp = require('mkdirp');
var probe = require('node-ffprobe');
var wav = require('wav');



var fs = require('fs');
var path = require('path');
var config = require('./config.json');
var Db = require('mongodb').Db,
  Connection = require('mongodb').Connection,
  Server = require('mongodb').Server;

var dbhostfallback = process.env.PORT ? 'proximus.modulusmongo.net' : 'localhost'; //are we on Modulus.IO?
var dbportfallback = process.env.PORT ? 27017 : Connection.DEFAULT_PORT; //are we on Modulus.IO?
var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : dbhostfallback;
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : dbportfallback;
var scanner = new Db('scanner', new Server(host, port, {}));
var db;
var channels = {};

const FILE_EXTENSIONS = ['.m4a', '.wav', '.mp3']; //MUST ALL BE LOWER CASE

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .use(nib())
}

function validExtension(ext) {
  for (i=0; i<FILE_EXTENSIONS.length; i++) {
    if (FILE_EXTENSIONS[i].toLowerCase() == ext.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function add_file(files, i) {
  if ( i< files.length) {
    var f = path.join(source_path, files[i]);
    console.log("Trying: " +f);
    
    var ext = path.extname(f);
    if (validExtension(ext)) {
      var name = path.basename(f, ext);
      var regex = /([0-9]*)-([0-9]*)/
      var result = name.match(regex);
      var tg = parseInt(result[1]);
      var time = new Date(parseInt(result[2]) * 1000);
      var base_path = __dirname+'/public/media';
      var local_path = "/" + time.getFullYear() + "/" + time.getMonth() + "/" + time.getDate() + "/";
      var target_path = base_path + local_path;
      console.log("Target Path: " + target_path);

      mkdirp.sync(base_path + local_path, function(err) {
        if (err) console.log(err);
      });
      var target_file = base_path + local_path + path.basename(f);
      console.log("Target File: " + target_file + " Source: " + f);
      fs.renameSync(f, target_file);
      console.log('Moved: ' + f);

      /*var reader = new wav.Reader();
      var input = fs.createReadStream(target_file);
      input.pipe(reader);
      reader.on('format', function() {
      */
      probe(target_file, function(err, probeData) {
        transItem = {
          talkgroup: tg,
          time: time,
          name: path.basename(f),
          path: local_path
        };

        //transItem.len = reader.chunkSize / reader.byteRate;
          if (err) {
            console.log("Error with FFProbe: " + err);
            transItem.len = 3;
          } else {
            transItem.len = probeData.format.duration;
          }
        
        db.collection('transmissions', function(err, transCollection) {
          transCollection.insert(transItem);
          console.log("Added: " + f);
          add_file(files,i+1);
        });

      });

      /*
      reader.on('data', function(chunk) {
        //console.log('got %d bytes of data', chunk.length);
      });
      reader.on('end', function() {
        console.log('end');
          input.unpipe(reader);
          add_file(files,i+1);
      });*/
    } else {
      add_file(files,i+1);
    }

  }
}



var source_path = __dirname+'/smartnet-upload';

scanner.open(function(err, scannerDb) {
  db = scannerDb;
  scannerDb.authenticate(config.dbUser, config.dbPass, function() {});

  if (!fs.existsSync(source_path)){
    console.log("Created Path: " + source_path);
    fs.mkdirSync(source_path);
  }

  var files = fs.readdirSync(source_path);
  console.log("Found " + files.length + " Files");
  add_file(files,0);
});
