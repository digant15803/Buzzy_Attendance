require('dotenv').config();
const passport = require("passport");
const LocalStrategy = require('passport-local');
const express = require("express");

const ejs = require("ejs");
const _ = require("lodash");

const app = express();
var session = require("express-session");
var MySQLStore = require("express-mysql-session")(session);
const flash = require('connect-flash');



app.set('view engine','ejs');
app.use(express.static("public"));

const bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({extended: true}));


const mysql = require('mysql');

const con = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE
});

app.use(session({
  key: 'session_cookie_name',
  secret: 'session_cookie_secret',
  resave: false,
  saveUninitialized: false,
  cookie:{
  maxAge: 1000*60*60*24*30,
}
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});



passport.serializeUser((user,done)=>{
  done(null,user.emailid);
});

passport.deserializeUser(function(userID,done){
  con.query('SELECT * FROM (SELECT * FROM mydb.facuser UNION SELECT * FROM mydb.studentdata) a WHERE a.emailid like (?)',[userID],function(err,result){
    done(null,result[0]);
  });
});

passport.use('local', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, email, password, done) { // callback with email and password from our form
         con.query("SELECT * FROM (SELECT * FROM mydb.facuser UNION SELECT * FROM mydb.studentdata) a WHERE a.emailid like (?)",email,function(err,rows){
			 if (err)
          return done(err);
			 if (!rows.length) {
                return done(null, false,req.flash('loginMessage', 'Oops! Username does not exist.'));
            }
			// if the user is found but the password is wrong
            if (!( rows[0].password == password))
                return done(null, false,req.flash('loginMessage', 'Oops! Wrong Password.'));

            // all is well, return successful user
            return done(null, rows[0]);

		});
}));





app.get("/",function(req, res){
   res.render("login",{message: req.flash('loginMessage')});
 });

 app.post("/",passport.authenticate('local', {
  successRedirect: '/timepass',
  failureRedirect: '/',
  failureFlash : true
}));

app.get("/timepass",function(req,res){
  if(req.user.tf === 0){
    res.redirect("/student");
  }
  else{
    res.redirect("/faculty");
  }
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect('/');
});

app.get("/student",function(req,res){
  if(req.isAuthenticated()){
    let sql = "SELECT * FROM (SELECT * FROM studentdata s LEFT JOIN (SELECT * FROM enroledin NATURAL JOIN courses NATURAL JOIN facultydetails) e on s.enrolno = e.enrolnoD where s.enrolno = ?) tab1 LEFT JOIN (SELECT * FROM ((SELECT cCode as mCourse,count(*) as Tcount FROM mydb.session WHERE tbool = 1 group by cCode order by cCode)  temp1 LEFT JOIN (SELECT courseC,count(buzzattendance) as count FROM mydb.attendance WHERE finalattendance = true and enrolmentno = ? order by courseC)  temp2 on temp2.courseC = temp1.mCourse)) tab2 on tab1.coursecode = tab2.mCourse;";

    con.query(sql,[req.user.facultyid,req.user.facultyid], function (err, result) {
      if (err) throw err;
      res.render("studentCourses",{enrolnofa: req.user.facultyid, name: req.user.facname, courses: result, headingVariable: "Courses"});
    });

  }
  else{
    res.redirect("/");
  }

});


app.get("/student/:courseName",function(req,res){
    let time;
    let tBuzzA;
    let fBuzzA;
    let arrayBuzz;
    let courselist;
    let coursefullName = "";
    let courseCodeVar = req.params.courseName;
    if(req.isAuthenticated()){
      let sql = "SELECT * FROM mydb.enroledin NATURAL JOIN courses WHERE enrolnoD = ? ";

      con.query(sql,[req.user.facultyid], function (err, result) {
        if (err) throw err;
        courselist = result;

      });
      sql = "SELECT * FROM session WHERE DATE(date_time) = DATE(sysdate()) AND cCode = (?) AND tbool = 1";
      con.query(sql,courseCodeVar, function (err, result) {
        if (err) throw err;
        courselist.forEach(function(courseN){
          if(courseN.coursecode === req.params.courseName){
            coursefullName = courseN.coursename;
          }
        });
        if(result.length === 0){
          res.render("late",{displayMsg: "Attendance Process is not yet started.",enrolnofa: req.user.facultyid, name: req.user.facname, courseCode: courseCodeVar, courses: courselist, enrolid: req.user.facultyid, headingVariable: courseCodeVar + ": " + coursefullName});
        }
        else{
          time = result[result.length-1].date_time;
          tBuzzA = result[result.length-1].tBuzz.split(",");
          fBuzzA = result[result.length-1].fBuzz.split(",");
          tBuzzA.pop();
          fBuzzA.pop();

          if(fBuzzA[0] === ''){
            arrayBuzz = tBuzzA;
          }
          else if(tBuzzA[0] === ''){
            arrayBuzz = fBuzzA;
          }
          else{
            arrayBuzz = tBuzzA.concat(fBuzzA);
          }
          shuffle(arrayBuzz);


          var t = new Date(time.toString());
          t.setSeconds(t.getSeconds() + arrayBuzz.length*3.5);
          var countDownDate = t.getTime();
          var nowF = new Date().getTime();

          // Find the distance between now and the count down date
          var distanceF = countDownDate - nowF;
          if(distanceF < 0){
            res.render("late",{displayMsg: "Attendance has been marked.",enrolnofa: req.user.facultyid, name: req.user.facname, courseCode: req.params.courseName, courses: courselist, enrolid: req.user.facultyid, headingVariable: req.params.courseName + ": " + coursefullName});

          }
          else{
            let timeCount = arrayBuzz.length*3.5;
            res.render("studentInput",{noofWord: timeCount, timeF: time, enrolnofa: req.user.facultyid,name: req.user.facname, courseCode: courseCodeVar, courses: courselist, buzzWords: arrayBuzz, enrolid: req.user.facultyid, headingVariable: courseCodeVar + ": " + coursefullName});

          }
        }

      });
    }
    else{
      res.redirect("/");
    }

  });
app.post("/student/:courseName",function(req,res){
    let myMap = new Map();
    let countT = 0;
    let countF = 0;
    let boolAttendance = false;
    let count = 0;
    let countW = 0;
    let tBuzzA;
    let fBuzzA;
    let arrayBuzz;

    let sql = "SELECT * FROM session WHERE DATE(date_time) = DATE(sysdate()) AND cCode = (?) AND tbool = 1";
    con.query(sql,[req.body.courseName], function (err, result) {
      if (err) throw err;

        tBuzzA = result[result.length-1].tBuzz.split(",");
        fBuzzA = result[result.length-1].fBuzz.split(",");
        tBuzzA.pop();
        fBuzzA.pop();

        countT = tBuzzA.length;
        countF = fBuzzA.length;
        if(fBuzzA[0] === ''){
          arrayBuzz = tBuzzA;
          tBuzzA.forEach(function(word){
             myMap.set(word,1);
          });
        }
        else if(tBuzzA[0] === ''){
          arrayBuzz = fBuzzA;
          fBuzzA.forEach(function(word){
            myMap.set(word,0);
          });
        }
        else{
          arrayBuzz = tBuzzA.concat(fBuzzA);
          tBuzzA.forEach(function(word){
            myMap.set(word,1);
          });
          fBuzzA.forEach(function(word){
            myMap.set(word,0);
          });
      }


    arrayBuzz.forEach(function(word){
      if (myMap.get(word) == req.body[word]){
        count = count + 1;
      }
      else if(myMap.get(word) == 0 && req.body[word] == 1){
        countW = countW + 1;
      }
    });
    if((count/countT)*100 >= 80 && (countW/countF)*100 <= 35){
      boolAttendance = true;
    }
    else{
      boolAttendance = false;
    }

    sql = "UPDATE attendance SET buzzattendance = ? WHERE DATE(sessionDate) = DATE(?) AND enrolmentno = ? AND courseC = ?";
    con.query(sql,[boolAttendance,new Date(),req.user.facultyid,req.body.courseName], function (err, result) {
      if (err) throw err;
    });
  });

    res.redirect("/student");
});



app.get("/student/:courseCode/attendance",function(req,res){
  if(req.isAuthenticated()){
    let dates =[];
    let courseList;
    let pCount = 0;
    let tCount = 0;
    let dateMap = new Map();

    let sql = "SELECT * FROM mydb.enroledin NATURAL JOIN courses WHERE enrolnoD = ? ";

    con.query(sql,req.user.facultyid, function (err, result) {
      if (err) throw err;
      courseList = result;

    });


    con.query("SELECT DATE(date_time) time FROM session WHERE cCode = ? AND tbool = 1",req.params.courseCode,function(err,result){
      if (err) throw err;

      console.log(result);
      result.forEach(function(temp){
          dateMap.set(temp.time.toDateString(),0);
          dates.push(temp.time.toDateString());
          tCount = tCount+1;
      });

      console.log(dates);
      con.query("SELECT DATE(sessionDate) time,finalattendance FROM attendance WHERE enrolmentno = ? and courseC = ?",[req.user.facultyid,req.params.courseCode],function(err,result){
        if(err) throw err;

        result.forEach(function(temp){
          if(temp.finalattendance == 1){
            dateMap.set(temp.time.toDateString(),1);
            pCount = pCount+1;
          }
        });
        if(dates.length==0){
          res.render("studentAtt",{attendance: [],map: dateMap,pCount: 0 ,tCount: 0, enrolnofa: req.user.facultyid, name: req.user.facname, courses: courseList, headingVariable: "Attendance", tbool: false});
        }
        else{
          res.render("studentAtt",{attendance: dates,map: dateMap,pCount: pCount ,tCount: tCount, enrolnofa: req.user.facultyid, name: req.user.facname, courses: courseList, headingVariable: "Attendance", tbool: true});
        }
      });

    });
  }
  else{
    res.redirect("/");
  }

});

















////////////////////////////////////////////////////////////////////      Faculty       ////////////////////////////////////////////////////////

app.get("/faculty",function(req,res){
  if(req.isAuthenticated()){
    let sql = "SELECT * FROM courses NATURAL JOIN facultydetails where facid = (?)";
    con.query(sql,req.user.facultyid, function (err, result) {
      if (err) throw err;

      res.render("facultyCourses",{enrolnofa: req.user.facultyid, name: req.user.facname, courses: result, headingVariable: "Courses"});
    });

  }
  else{
    res.redirect("/");
  }

});

app.post("/faculty",function(req,res){
  let d = req.body.date;
  let code = req.body.courseCode;
  if(req.body.submit == "b"){
    res.redirect("/faculty/"+d+"/"+code);
  }
  else{
    res.redirect("/faculty/"+d+"/"+code+"/attendance");
  }
});

app.post("/faculty/:date/:courseCode/attendance",function(req,res){
  res.redirect("/faculty/"+req.body.dateNew+"/"+req.body.course+"/attendance");
});


app.get("/faculty/:date/:courseCode/attendance",function(req,res){
  if(req.isAuthenticated()){
    let courseList;
    let ps=0;
    let noOfS = 0;
    var sList;
    let c = false;
    let attMap = new Map();
    let sql = "SELECT * FROM courses NATURAL JOIN facultydetails where facid = (?)";
    con.query(sql,req.user.facultyid, function (err, result) {
      if (err) throw err;

      courseList = result;
    });
    con.query("SELECT * FROM session WHERE DATE(date_time) = DATE(?) and cCode = ? AND tbool = 1",[req.params.date,req.params.courseCode],function(err,result){
      if (err) throw err;

      if(result.length == 0){
        c = false;
      }
      else{
        c = true;
      }
      if(c & ((new Date(req.params.date).getTime()-new Date().getTime())<0)){
        con.query("SELECT * FROM enroledin INNER JOIN studentdata on enrolnoD=enrolno WHERE coursecode = ? ORDER BY enrolnoD",req.params.courseCode, function (err, result) {
          if (err) throw err;

          sList = result;
          noOfS = result.length;
          sList.forEach(function(student){
            attMap.set(student.enrolnoD,0);
          });

          con.query("SELECT * FROM attendance WHERE courseC = ? AND DATE(sessionDate) = DATE(?)",[req.params.courseCode,req.params.date], function (err, result) {
            if (err) throw err;

            result.forEach(function(student){
              if(student.finalattendance == true){
                attMap.set(student.enrolmentno,1);
                ps = ps+1;
              }
            });

            res.render("FacAtt",{enrolnofa: req.user.facultyid, name: req.user.facname, courses: courseList ,headingVariable: "Attendance",students: sList, attMap: attMap, c: c, ps: ps, noOfS: noOfS, dateP: req.params.date, courseCo: req.params.courseCode});
          });
        });
      }
      else{
        res.render("FacAtt",{enrolnofa: req.user.facultyid, name: req.user.facname, courses: courseList ,headingVariable: "Attendance",students: sList, attMap: attMap, c: false, ps: 0, noOfS: 0, dateP: req.params.date, courseCo: req.params.courseCode});

      }
    });
  }
  else{
    res.redirect("/")
  }

});

app.post("/faculty/markAttendance",function(req,res){
  let data = req.body.data;
  let date = req.body.dateM;
  let course = req.body.course;

  let sArray = data.split(",");
  sArray.pop();

  sArray.forEach(function(enrl){
    con.query("UPDATE attendance SET biometricattendance = true WHERE DATE(sessionDate) = DATE(?) AND enrolmentno = ? AND courseC = ?",[date,enrl,course],function(err,result){
      if(err) throw err;
    });
  });

  res.redirect("/faculty");

});


app.get("/faculty/:courseCode",function(req,res){
    if(req.isAuthenticated()){
      let correctList = [];
      let incorrectList = [];
      let courseList;
      let sql = "SELECT * FROM courses NATURAL JOIN facultydetails where facid = (?)";
      con.query(sql,req.user.facultyid, function (err, result) {
        if (err) throw err;

        courseList = result;
      });

      con.query("SELECT * FROM session WHERE DATE(date_time) = DATE(sysdate()) AND cCode = ?",req.params.courseCode, function (err, result) {
        if (err) throw err;

        if(result.length!=0){
          if(result[0].tBuzz != null){
            correctList = result[0].tBuzz.split(",");
            correctList.pop();
          }
          if(result[0].fBuzz != null){
            incorrectList = result[0].fBuzz.split(",");
            incorrectList.pop();
          }
        }

      res.render("facultyIn",{enrolnofa: req.user.facultyid, name: req.user.facname, courses: courseList ,headingVariable: "Enter BuzzWords", correctList: correctList, incorrectList: incorrectList, courseCode: req.params.courseCode});
      });

    }
    else{
      res.redirect("/");
    }
  })
app.post("/faculty/:courseCode",function(req,res){

  if(req.isAuthenticated()){
    let correctList;

    let sql = "SELECT * FROM courses NATURAL JOIN facultydetails where facid = (?)";
    con.query(sql,req.user.facultyid, function (err, result) {
      if (err) throw err;

      courseList = result;
    });
    if(req.body.submit=="submit"){
      con.query("UPDATE session set date_time = sysdate(), tbool = 1 WHERE cCode = ? AND tbool = 0",req.body.hidden, function (err, result) {
        if (err) throw err;

        res.redirect("/faculty");
      });

    }
    else{
      let incorrectArr = [];
      let correctArr = [];
      let courseList;
      let tBuzz = "";
      let fBuzz = "";
      let item = req.body.newItem;
      sql = "SELECT * FROM courses NATURAL JOIN facultydetails where facid = (?)";
      con.query(sql,req.user.facultyid, function (err, result) {
        if (err) throw err;
        courseList = result;


        con.query("SELECT * FROM session WHERE DATE(date_time) = DATE(sysdate()) AND cCode = ?",req.body.hidden, function (err, result) {
          if (err) throw err;

          if(result.length == 0){
            con.query("INSERT INTO session VALUES(?,sysdate(),?,?,'0')",[req.body.hidden,null,null], function (err, result) {
              if (err) throw err;
            });
          }

          if(result.length == 0){
            tBuzz = "";
            fBuzz = "";
          }
          else{
            if(result[0].tBuzz != null){
              tBuzz = result[0].tBuzz;
            }
            else{
              tBuzz = "";
            }

            if(result[0].fBuzz != null){
              fBuzz = result[0].fBuzz;
            }
            else{
              fBuzz = "";
            }
          }


          if(req.body.list==="incorrect"){
              if(item!=""){
                fBuzz+=item+",";
                con.query("UPDATE session set fBuzz = ? WHERE DATE(date_time) = DATE(sysdate()) AND cCode = (?) AND tbool = '0'",[fBuzz,req.body.hidden], function (err, result) {
                  if (err) throw err;
                });
              }
            }else{
              if(item!=""){
                tBuzz+=item+",";
                con.query("UPDATE session SET tBuzz = ? WHERE DATE(date_time) = DATE(sysdate()) AND cCode = (?) AND tbool = '0'",[tBuzz,req.body.hidden], function (err, result) {
                  if (err) throw err;
                });
              }
            }
            if(tBuzz != undefined ){
              correctArr = tBuzz.split(",");
              correctArr.pop();
            }
            if(fBuzz != undefined ){
              incorrectArr = fBuzz.split(",");
              incorrectArr.pop();
            }


            res.render("facultyIn",{enrolnofa: req.user.facultyid, name: req.user.facname, courses: courseList ,headingVariable: "Enter BuzzWords", correctList: correctArr, incorrectList: incorrectArr, courseCode: req.params.courseCode});


        });

      });
    }
  }
  else{
    res.redirect("/");
  }
});












app.get("/faculty/:date/:courseCode",function(req,res){
    if(req.isAuthenticated()){
      let d = new Date(req.params.date);
      let correctList = [];
      let incorrectList = [];
      let courseList;
      let sql = "SELECT * FROM courses NATURAL JOIN facultydetails where facid = (?)";
      con.query(sql,req.user.facultyid, function (err, result) {
        if (err) throw err;

        courseList = result;

      });

      con.query("SELECT * FROM session WHERE DATE(date_time) = DATE(?) AND cCode = ?",[d,req.params.courseCode], function (err, result) {
        if (err) throw err;

        if(result.length!=0){
          if(result[0].tBuzz != null){
            correctList = result[0].tBuzz.split(",");
            correctList.pop();
          }
          if(result[0].fBuzz != null){
            incorrectList = result[0].fBuzz.split(",");
            incorrectList.pop();
          }
        }

      res.render("facultyInA",{enrolnofa: req.user.facultyid, name: req.user.facname, courses: courseList ,headingVariable: "Enter BuzzWords", correctList: correctList, incorrectList: incorrectList, courseCode: req.params.courseCode, dateP: d});
      });

    }
    else{
      res.redirect("/");
    }
  })
app.post("/faculty/:date/:courseCode",function(req,res){
  if(req.isAuthenticated()){
      let d = new Date(req.body.dateP);
      let incorrectArr = [];
      let correctArr = [];
      let courseList;
      let tBuzz = "";
      let fBuzz = "";
      let item = req.body.newItem;
      let sql = "SELECT * FROM courses NATURAL JOIN facultydetails where facid = (?)";
      con.query(sql,req.user.facultyid, function (err, result) {
        if (err) throw err;
        courseList = result;

      });

      con.query("SELECT * FROM session WHERE DATE(date_time) = DATE(?) AND cCode = ?",[d,req.body.hidden], function (err, result) {
        if (err) throw err;

        if(result.length == 0){
          con.query("INSERT INTO session VALUES(?,?,?,?,'0')",[req.body.hidden,d,null,null], function (err, result) {
            if (err) throw err;
          });
        }

        if(result.length == 0){
          tBuzz = "";
          fBuzz = "";
        }
        else{
          if(result[0].tBuzz != null){
            tBuzz = result[0].tBuzz;
          }
          else{
            tBuzz = "";
          }

          if(result[0].fBuzz != null){
            fBuzz = result[0].fBuzz;
          }
          else{
            fBuzz = "";
          }
        }


        if(req.body.list==="incorrect"){
            if(item!=""){
              fBuzz+=item+",";
              con.query("UPDATE session set fBuzz = ? WHERE DATE(date_time) = DATE(?) AND cCode = (?) AND tbool = '0'",[fBuzz,d,req.body.hidden], function (err, result) {
                if (err) throw err;
              });
            }
          }else{
            if(item!=""){
              tBuzz+=item+",";
              con.query("UPDATE session SET tBuzz = ? WHERE DATE(date_time) = DATE(?) AND cCode = (?) AND tbool = '0'",[tBuzz,d,req.body.hidden], function (err, result) {
                if (err) throw err;
              });
            }
          }
          if(tBuzz != undefined ){
            correctArr = tBuzz.split(",");
            correctArr.pop();
          }
          if(fBuzz != undefined ){
            incorrectArr = fBuzz.split(",");
            incorrectArr.pop();
          }


          res.render("facultyInA",{enrolnofa: req.user.facultyid, name: req.user.facname, courses: courseList ,headingVariable: "Enter BuzzWords", correctList: correctArr, incorrectList: incorrectArr, courseCode: req.params.courseCode, dateP: d});


      });
  }
  else{
    res.redirect("/");
  }
});


  //////////////////////////               Shuffle function            ////////////////////////////////////////////////////////////////////

  function shuffle(array) {
    let currentIndex = array.length,  randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }

    return array;
  }
