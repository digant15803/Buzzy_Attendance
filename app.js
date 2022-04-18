const express = require("express");

const ejs = require("ejs");
const _ = require("lodash");

const app = express();
app.set('view engine','ejs');
app.use(express.static("public"));

const bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({extended: true}));


const mysql = require('mysql');

const con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "mydb"
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});

let enrol = "";
let facid = "";
let signin = false;
let faculty = false;
let student = false;
app.get("/",function(req, res){
   res.render("login",{incorrect: false});
 });

app.post("/",function(req,res){
  let pwd = req.body.pswd;
  let emailid = req.body.email;
   let sql = "SELECT * FROM (SELECT * FROM mydb.facuser UNION SELECT * FROM mydb.studentdata) a WHERE a.emailid like (?) AND a.password like (?)";
  con.query(sql,[emailid, pwd], function (err, result) {
      if (err) throw err;

      if(result.length === 0){
        res.render("login",{incorrect: true});
      }
      else{
        if(result[0].tf === 0){
          signin = true;
          student = true;
          incorrectBool = false;
          enrol = result[0].facultyid;
          res.redirect("/student");
        }
        else if(result[0].tf === 1){
          signin = true;
          faculty = true;
          incorrectBool = false;
          facid = result[0].facultyid;
          res.redirect("/faculty");
        }
      }
  });
});

let courselist;
app.get("/student",function(req,res){
  if(signin){
    let sql = "SELECT * FROM (SELECT * FROM studentdata s LEFT JOIN (SELECT * FROM enroledin NATURAL JOIN courses NATURAL JOIN facultydetails) e on s.enrolno = e.enrolnoD where s.enrolno = ?) tab1 LEFT JOIN (SELECT * FROM ((SELECT courseC as mCourse,count(*) as Tcount FROM mydb.attendance order by courseC)  temp1 LEFT JOIN (SELECT courseC,count(buzzattendance) as count FROM mydb.attendance WHERE buzzattendance = true and enrolmentno = ? order by courseC)  temp2 on temp2.courseC = temp1.mCourse)) tab2 on tab1.coursecode = tab2.mCourse";

    //let sql = "SELECT * FROM studentdata s LEFT JOIN (SELECT * FROM enroledin NATURAL JOIN courses NATURAL JOIN facultydetails) e on s.enrolno = e.enrolnoD where s.enrolno = (?)";
    con.query(sql,[enrol,enrol], function (err, result) {
      if (err) throw err;
      courselist = result;
      res.render("studentCourses",{enrolnofa: enrol, courses: result, headingVariable: "Courses"});
    });

  }
  else{
    res.redirect("/");
  }

});

let countT = 0;
let countF = 0;
let time;
let coursefullName = "";
let courseCodeVar = "";
let boolAttendance = false;
app.route("/student/:courseName")
  .get(function(req,res){
    courseCodeVar = req.params.courseName;
    if(signin){
      let sql = "SELECT * FROM session WHERE DATE(date_time) = DATE(sysdate()) AND cCode = (?)";
      con.query(sql,courseCodeVar, function (err, result) {
        if (err) throw err;
        courselist.forEach(function(courseN){
          if(courseN.coursecode === req.params.courseName){
            coursefullName = courseN.coursename;
          }
        });
        if(result.length === 0){
          res.render("late",{displayMsg: "Attendance Process is not yet started.",enrolnofa: enrol, courseCode: courseCodeVar, courses: courselist, enrolid: enrol, headingVariable: courseCodeVar + ": " + coursefullName});


        }
        else{
          time = result[result.length-1].date_time;
          tBuzzA = result[result.length-1].tBuzz.split(",");
          fBuzzA = result[result.length-1].fBuzz.split(",");

          countT = tBuzzA.length;
          countF = fBuzzA.length;
          //setValue(result);
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
          shuffle(arrayBuzz);


          var t = new Date(time.toString());
          t.setSeconds(t.getSeconds() + 25 +2);
          var countDownDate = t.getTime();
          var nowF = new Date().getTime();

          // Find the distance between now and the count down date
          var distanceF = countDownDate - nowF;
          if(distanceF < 0){
            res.render("late",{displayMsg: "Attendance has been marked.",enrolnofa: enrol, courseCode: req.params.courseName, courses: courselist, enrolid: enrol, headingVariable: req.params.courseName + ": " + coursefullName});

          }
          else{
            res.render("studentInput",{timeF: time, enrolnofa: enrol, courseCode: courseCodeVar, courses: courselist, buzzWords: arrayBuzz, enrolid: enrol, headingVariable: courseCodeVar + ": " + coursefullName});

          }
        }

      });
    }
    else{
      res.redirect("/");
    }

  })
  .post(function(req,res){
    let count = 0;
    let countW = 0;
    arrayBuzz.forEach(function(word){
      if (myMap.get(word) == req.body[word]){
        count = count + 1;
      }
      else if(myMap.get(word) == 0 && req.body[word] == 1){
        countW = countW + 1;
      }
    });
    if((count/countT)*100 >= 75 && (countW/countF)*100 <= 35){
      boolAttendance = true;
    }
    console.log(count);
    console.log(countW);
    console.log(boolAttendance);

    let sql = "INSERT INTO attendance VALUES(?,?,DATE(?),?,DEFAULT,DEFAULT)";
    con.query(sql,[enrol,courseCodeVar,new Date(),boolAttendance], function (err, result) {
      if (err) throw err;
      });




    res.redirect("/student");
    // let countS = 5;
    // res.render("attendance",{bool: boolAttendance,enrolnofa: enrol, courseCode: courseCodeVar, courses: courselist, enrolid: enrol, headingVariable: courseCodeVar + ": " + coursefullName});
    // setInterval(function(){
    //   countS--;
    //   console.log(countS);
    //   if (countS == 0) {
    //
    //   }
    // },1000);
  })
  let tBuzzA;
  let fBuzzA;
  let arrayBuzz;
  const myMap = new Map();




////////////////////////////////////////////////////////////////////      Faculty       /////////////////////////////////////////////////////////

let coursesFaculty;

app.get("/faculty",function(req,res){
  if(signin){
    let sql = "SELECT * FROM courses NATURAL JOIN facultydetails where facid = (?)";
    con.query(sql,facid, function (err, result) {
      if (err) throw err;

      coursesFaculty = result;
      res.render("facultyCourses",{enrolnofa: facid, courses: coursesFaculty, headingVariable: "Courses"});
    });

  }
  else{
    res.redirect("/");
  }

});


app.route("/faculty/:courseCode")
  .get(function(req,res){
    if(signin){
      res.render("facultyInput",{facultyid: facid,courseCode: req.params.courseCode});
    }
    else{
      res.redirect("/");
    }
  })
  .post(function(req,res){
    let trueW = req.body.trueWords;
    let trueF = req.body.falseWords;
      let sql = "INSERT INTO session VALUES(?,sysdate(),?,?)";
      con.query(sql,[req.params.courseCode,trueW,trueF], function (err, result) {
        if (err) throw err;


        res.redirect("/faculty");
      });
  })


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
