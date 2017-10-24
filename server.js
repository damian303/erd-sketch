var express = require('express'),
    app = express(),
    http = require('http'),
    socketIo = require('socket.io'),
    session = require('express-session'),//session = require('client-sessions'),
    bodyParser = require('body-parser'),
    jade = require('jade'),
    randomstring = require('randomstring'),
    sharedsession = require("express-socket.io-session"),
    cookie = require('cookie'),
    cookieParser = require('cookie-parser'),
    sessionStore = new session.MemoryStore(),
    bcrypt = require('bcryptjs'),
    MongoClient = require('mongodb').MongoClient,
    Mailgun = require('mailgun-js'),
    MobileDetect = require('mobile-detect');


// Mailgun setup
var api_key = '';
var domain = 'mail.erdsketch.com';
var from_who = 'invite@erdsketch.com';

var server =  http.createServer(app);
var io = socketIo.listen(server);
var port = 8001;
    server.listen(port);
    // add directory with our static files
    console.log("Server running on "+port);

var clients = {};
var SALT_WORK_FACTOR = 10;
var COOKIE_SECRET = '';
var COOKIE_NAME = 'sid';

function send_email(member, invite_to, invite_from, pwd){
    if(member)var msg = 'Hello, <br>You have recieved an invite to work on a diagram from '+invite_from+'.<br>Simply log in to www.erdsketch.com and you will be able to open the diagram and work on it.<br>Kind Regards,<br>erdsketch';
    else var msg = 'Hello, <br>You have recieved an invite to work on a diagram from '+invite_from+'.<br>Simply log in to www.erdsketch.com using your email address and the password '+pwd+' and you will be able to open the diagram and work on it.<br>Kind Regards,<br>erdsketch';
    var mailgun = new Mailgun({apiKey: api_key, domain: domain});
    var data = {
      from: from_who,
      to: invite_to,
      subject: 'ERD Sketch Invite',
      html: msg  }
    //Invokes the method to send emails given the above data with the helper library
    mailgun.messages().send(data, function (err, body) {
        if (err) {
            console.log("got an error: ", err);
        }
        else {
            console.log("Message Sent")
            console.log(body);
        }
    });
}

// Connect to the db
MongoClient.connect("mongodb://localhost:27017/ERD_MACHINE", function(err, db) {
  if(!err) {
    var Diagram =  db.collection('erd');
    var User = db.collection('user');
    var data_obj = {table:[],shape:[], line:[], link:[], link_list:{}, totals:{table:0,shape:0, line:0}, lock:{}};
    var blank_erd = {table:[],shape:[], line:[], link:[], link_list:{}, totals:{table:0,shape:0, line:0}, lock:{}};

    app.use(express.static(__dirname + '/www/'))
    app.use(cookieParser())
    .use(session({
      name: COOKIE_NAME,
      secret: COOKIE_SECRET,
      store: sessionStore,
      saveUninitialized: true,
      resave: true,
      cookie: {
          path: '/',
          httpOnly: true,
          secure: false,
          maxAge: null
      }
    }))
    app.use( bodyParser.json() );       // to support JSON-encoded bodies
    app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
      extended: true
    }))

    app.set('view engine', 'jade')
    app.get('/', function(req, res) {
      console.log("get/")
      res.redirect('/draw_start');
    });

    app.post('/login', function(req, res) {
      console.log("post/login")
      console.log("login attempt")
      var start_page;
      md = new MobileDetect(req.headers['user-agent']);
      if(md.mobile()===null)start_page = 'draw_start';
      else start_page = 'draw_start_mobile';
      
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          console.log("user not found ")
          res.render(start_page, { login_error: 'Invalid email or password.' });
        } else {
          if(bcrypt.compareSync(req.body.password, user.password)){
            // sets a cookie with the user's info
            req.session.username = req.body.email;
            req.session.erd_id = user.erds[user.erds.length-1].erd_id;// Choose the last erd in the list
            req.session.erd_name =  user.erds[user.erds.length-1].name;
            User.update({ email: req.body.email }, {$inc: {'logins':1}, $set:{lastLoginTime:Date.now()}}, {}, function(err, result) {
              if(!err){console.log("result "+result)}
              else console.log("err : "+err);
            });
            res.redirect('/draw');

          } else {
            res.render(start_page, { login_error: 'Incorrect email or password' });
          }
        }
      });
    });

    app.post('/signup', function(req, res) {
      var start_page;
      md = new MobileDetect(req.headers['user-agent']);
      if(md.mobile()===null)start_page = 'draw_start';
      else start_page = 'draw_start_mobile';

      if(req.body.password1 == req.body.password2){
        if(req.body.password1.length > 6){
          if(req.body.email.indexOf("@")!=-1){
            User.findOne({ email: req.body.email }, function(err, user) {
              if (user) {
                res.render(start_page, { signup_error: 'This email is already signed up!' });
              } else {
                var new_erd_id;
                newID();
                function newID(){
                  new_erd_id = "erd_"+randomstring.generate({length: 12,charset: 'alphabetic'});
                  Diagram.findOne({erd_id:new_erd_id}, function(err, check_exists) {if(check_exists)newID()});
                }
                erd_name = "ERD 1";// add numbers to this from count
                Diagram.insert({erd_id:new_erd_id, name:erd_name, erd:JSON.parse(req.body.erd_to_server)})
                User.insert({email:req.body.email, password:bcrypt.hashSync(req.body.password1, 8),
                  erds:[{erd_id:new_erd_id, name:erd_name}], logins:1, lastLoginTime:Date.now(), totalTime:1}, {w:1}, function(err, result){
                  if(!err){
                    req.session.username = req.body.email;
                    req.session.erd_id = new_erd_id;
                    req.session.erd_name = erd_name;
                    res.redirect("/draw");
                    }else{
                      res.render(start_page, { signup_error: 'Signup failed, sorry. '+err });
                    }
                  });
              }
            });
          }else{
            res.render(start_page, { signup_error: 'Not a valid email address.' });
          }
        }else{
          res.render(start_page, { signup_error: 'The password must be over 6 characters.' });
        }
      }else{
        res.render(start_page, { signup_error: 'The passwords do not match!' });
      }
    });
    app.get('/draw_start', function(req, res) {
      var start_page;
      md = new MobileDetect(req.headers['user-agent']);
      if(md.mobile()===null)start_page = 'draw_start';
      else start_page = 'draw_start_mobile';
        var new_erd_id;
        newID();
        function newID(){
          new_erd_id = "erd_"+randomstring.generate({length: 12,charset: 'alphabetic'});
          Diagram.findOne({erd_id:new_erd_id}, function(err, check_exists) {if(check_exists)newID()});
        }
        req.session.username = "Trial_User";
        req.session.erd_name = "Example";
        req.session.erd_id = new_erd_id;
        res.render(start_page, { username: req.session.username, erd_name:req.session.erd_name, erd_id:req.session.erd_id });
    });
    app.get('/draw', function(req, res) {
      var start_page, draw_page;
      md = new MobileDetect(req.headers['user-agent']);
      if(md.mobile()===null){start_page = 'draw_start'; draw_page = 'draw'}
      else {start_page = 'draw_start_mobile'; draw_page = 'draw_mobile'}

      if (req.session.username!=undefined) { // Check if session exists
        // lookup the user in the DB by pulling their email from the session
        User.findOne({ email: req.session.username }, function (err, user) {
          if (!user) {
            // if the user isn't found in the DB, reset the session info and
            // redirect the user to the login page
            if(req.session)req.session.reset();
            res.render(start_page, { login_error: 'Incorrect email or password' });
          } else {
            // expose the user to the template
            res.locals.user = user;
            // render the dashboard page
            res.render(draw_page, { username: req.session.username, erd_name:req.session.erd_name, erd_id:req.session.erd_id });// this was using user.erd_id
          }
        });
      } else {
        res.render(start_page, { login_error: 'Incorrect email or password' });
      }
    });

    app.use(function(req, res, next) {// needs to be the last app.use function to catch 404
      md = new MobileDetect(req.headers['user-agent']);
      if(md.mobile()===null)res.render('/draw_start');
      else res.render('/draw_start_mobile')
    })

    var users = {};

    io.use(function(socket, next) {
        try {
            var data = socket.handshake || socket.request;
            if (! data.headers.cookie) {
                return next(new Error('Missing cookie headers'));
            }
            var cookies = cookie.parse(data.headers.cookie);
            if (! cookies[COOKIE_NAME]) {
                return next(new Error('Missing cookie ' + COOKIE_NAME));
            }
            var sid = cookieParser.signedCookie(cookies[COOKIE_NAME], COOKIE_SECRET);
            if (! sid) {
                return next(new Error('Cookie signature is not valid'));
            }
            console.log('session ID ( %s )', sid);
            data.sid = sid;
            sessionStore.get(sid, function(err, session) {
                if (err) return next(err);
                if (! session) return next(new Error('session not found'));
                data.session = session;
                next();
            });
        } catch (err) {
            console.error(err.stack);
            next(new Error('Internal server error'));
        }
    });

    // event-handler for new incoming connections
    io.on('connection', function (socket) {
      var erd_id = socket.handshake.session.erd_id;
      var erd_name = socket.handshake.session.erd_name;
      var username = socket.handshake.session.username;

      socket.on('trial_connect', function (res) {
        socket.join(erd_id);
      });

      socket.on('signup', function (res) {
        User.findOne({ email: res.email }, function(err, user) {
            erd_name = "ERD 1";// add numbers to this from count
            Diagram.insert({erd_id:erd_id, name:erd_name, erd:res.erd})
            User.insert({email:res.email, password:bcrypt.hashSync(res.password, 8),
              erds:[{erd_id:erd_id, name:erd_name}], logins:1, lastLoginTime:Date.now(), totalTime:1}, {w:1}, function(err, result){
                if(!err){
                  socket.handshake.session.username = res.email;
                  username = res.email;
                  io.to(erd_id).emit('signup', {success:{erd_id:erd_id, name:erd_name, erd:res.erd}});
                }else{
                  io.to(erd_id).emit('signup', {error:"Signup failed, sorry: "+err});
                }
              });
        });
      });

      socket.on('connect_user', function (res) {
        Diagram.findOne({erd_id:erd_id}, function(err, item) {
          if(!err){
            if(item==null){// No erd do create one NEEDS WORK!!//
              console.log("1 that erd_id does not exist")
              Diagram.insert({erd_id:erd_id, erd_name:erd_name, erd:blank_erd})
            }else{
              if(!users[erd_id])users[erd_id]=[];
              var user_exists = users[erd_id].filter(function(u){return u.name==socket.handshake.session.username});
              if(user_exists.length===0){
                users[erd_id].push({name:socket.handshake.session.username, active:false, x:0, y:0});
              }
              socket.join(erd_id);
              io.to(erd_id).emit('connect_user', {id:username, erd_name: erd_name, users:users[erd_id]});
              io.to(erd_id).emit('update_svg', {'user':'', 'data':item.erd});
            }
          }
          else console.log(err);
        });
      });

      socket.on('open_erd', function(res){
          Diagram.findOne({erd_id:res.erd.erd_id}, function(err, item) {
            if(!err){
                socket.leave(erd_id)
                erd_id = res.erd.erd_id;
                erd_name = item.name;
                socket.handshake.session.erd_id = erd_id;
                if(!users[erd_id])users[erd_id]=[{name:username, active:false, x:0, y:0}];
                else{
                  var user_exists = users[erd_id].filter(function(u){return u.name==username});
                  if(user_exists.length ==0)users[erd_id].push({name:username, active:false, x:0, y:0});
                }
                socket.join(erd_id);
                io.to(erd_id).emit('connect_user', {id:username, erd_name:erd_name, users:users[erd_id]});
                console.log(username+" connected to "+erd_id )
                io.to(erd_id).emit('update_svg', {'user':'', 'data':item.erd});
            }
            else console.log(err);
          });
        });

      socket.on('new_diagram', function (res) {
        if(res.user){
          User.findOne({email:res.user}, function(err, user){
            if(!err){
              if(user!=null){
                if(!res.filename)erd_name = "ERD_"+(user.erds.length+1);
                else erd_name = res.filename;
                newID();
                function newID(){
                  new_erd_id = "erd_"+randomstring.generate({length: 12,charset: 'alphabetic'});
                  Diagram.findOne({erd_id:new_erd_id}, function(err, check_exists) {if(check_exists)newID()});
                }
                erd_id = new_erd_id; // use the new name
                Diagram.insert({erd_id:erd_id, name:erd_name, erd:blank_erd});
                User.update({email:res.user}, {$push:{erds:{erd_id:erd_id, name:erd_name}}});
                socket.join(erd_id);
                io.to(erd_id).emit('new_erd_created',  {user:res.user,erd_id:new_erd_id, erd_name:erd_name, message:"New ERD: "+erd_name+" created."});
                io.to(erd_id).emit('update_svg', {'user':'', 'data':blank_erd});
              }
            }
          });
        }
      });

      socket.on('chat', function (res) {
        io.to(erd_id).emit('chat', res);
        Diagram.update({erd_id:erd_id}, {$push: {chat:{user_id:res.user, text:res.text, time:new Date()}}}, function(err, result) {
          if(err){console.log(err);}
          else console.log("chat saved "+ result)
        });
      });

      socket.on('save_svg', function (res) {
        Diagram.update({erd_id:erd_id}, {$set: {erd:res.data}}, {}, function(err, result) {
         if(!err){console.log("result "+result)}
         else {
           console.log("err : "+err);
           io.to(erd_id).emit('saving', "Error : "+err);
         }
        });
        Diagram.findOne({erd_id:erd_id}, function(err, item) {
         if(!err){
           if(item==null){
             io.to(erd_id).emit('saving', "Unable to save ERD!");
           }else{
             io.to(erd_id).emit('saving', "Your diagram "+erd_name+" has been saved.");
           }
         }
         else console.log(err);
        });
      });

      socket.on('update_svg', function (res) {
       io.to(erd_id).emit('update_svg', res);
      });

      socket.on('change_name', function (res) {
        console.log("changing name from "+erd_name+" to "+res.erd_name);
         erd_name = res.erd_name;
         socket.handshake.session.erd_name = res.erd_name;
         Diagram.update({erd_id:erd_id}, {$set: {name:erd_name}}, {}, function(err, result) {
           if(err){
             console.log("err : "+err);
             io.to(erd_id).emit('update_erd_name', {user:res.user, erd_name:erd_name});
           }
         });
       });

       socket.on('delete_file', function (res) {
        if(res){
          console.log("user : "+res.user+ " deleting file "+erd_id)
          Diagram.remove({erd_id:erd_id}, true);
          User.update({}, {$pull:{erds:{erd_id:erd_id}}});// Time consuming?? Maybe a share list in users is needed?
        }
       });

      socket.on('logout', function (res) {
         socket.leave(erd_id);
         for(u in users[erd_id]){
           if(users[erd_id][u].name == res.user){
             users[erd_id].splice(u,1);
           }
         }
         // Update usage start_offset
         var newTotalTime;
         User.findOne({email: res.user}, function(err, user) {
           if(!err){
             if(user){
               if(user.totalTime){
                 newTotalTime =user.totalTime+( Date.now() - user.lastLoginTime);
                 User.update({ email: res.user }, {$set: {totalTime:newTotalTime}}, {}, function(err, result) {
                   if(!err){console.log("result : "+result)}
                   else console.log("err : "+err);
                 });
               }
             }
           }
         });

      });

      socket.on('user_active', function (res) {
       io.to(erd_id).emit('user_active', res);
      });

      socket.on('resize', function (res) {
       io.to(erd_id).emit('resize', res);
      });

      socket.on('downloading_png', function (res) {
       console.log(res.user_id+" downloading png.")
      });

      socket.on('add_user', function (res) {
        if(res.email){
          User.findOne({email:res.email}, function(err, user){
            if(!err){
              if(user!=null){
                var erd_exists = user.erds.filter(function(item){return item.name==erd_name+'_'+username});// check do they already have access 
                if(erd_exists.length ==0){// They don't have access //
                  User.update({email:res.email}, {$push:{erds:{erd_id:erd_id, name:erd_name+'_'+username}}});/********************************************************** THIS COULD CAUSE A PROBLEM NEW ERDNAME FORMAT *****/
                  send_email(true, res.email, username);
                }
              }else{// The invited person is not signed up //
                temp_pwd = randomstring.generate({length: 12,charset: 'alphabetic'});
                User.insert({email:res.email, password:bcrypt.hashSync(temp_pwd, 8),
                    erds:[{erd_id:erd_id, name:erd_name+'_'+username}], logins:1, lastLoginTime:Date.now(), totalTime:1}, {w:1}, function(err, result){
                      if(!err){
                        send_email(false, res.email, username, temp_pwd);
                      }else{
                        console.log(err);
                      }
                });
              }
            }
          });
        }else{console.log("no res.email ")}
      });

      //populate_open_list
      socket.on('get_erd_list', function (res) {
        if(res.user){
          User.findOne({email:res.user}, function(err, user){
            if(!err){
              if(user!=null){
                io.to(erd_id).emit('populate_open_list',  {user:res.user,erd_list:user.erds});
              }
            }
          });
        }
      });
    });

  }else{
    console.log(err);
  }
});
