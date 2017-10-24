var MongoClient = require('mongodb').MongoClient;
MongoClient.connect("mongodb://localhost:27017/ERD_MACHINE", function(err, db) {
  if(!err) {
    var Diagram =  db.collection('erd');
    var User = db.collection('user');
    /*
        User.deleteMany({email:"foo@foo.com"},function(err, results) {
          if(err)console.log(err)
          else console.log(results);
        });// to remove a user
        User.deleteMany({email:'bar@bar.com'},function(err, results) {
            if(err)console.log(err)
            else console.log(results);
        });// to remove a user
        User.deleteMany({email:''},function(err, results) {
            if(err)console.log(err)
            else console.log(results);
        });// to remove a user*/
    console.log("Users : "+ User.count());
    console.log("Diagrams : "+Diagram.count());
    User.find().each(function(err, user){
      console.log(user);
    })
  }else{
    console.log(err);
  }
});
