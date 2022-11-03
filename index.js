const express = require("express");
const app = express();
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./db/database.db");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const PORT = 8080;
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  session({
    secret: "wesdfksdf@#$ff",
    resave: false,
    saveUninitialized: false,
  })
);

app.use((req, res, next) => {
  let logged = "";
  if (req.cookies.username) {
    logged = req.cookies.username;
  } else {
    logged = "not logged";
  }
  db.run(`
    insert into logs (path, user)
    values ("${req.hostname}:${PORT}${req.url}", "${logged}") 
  `);
  next();
});

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/login", (req, res) => {
  if (req.cookies.username && req.cookies.username) {
    res.redirect(`/user/${req.cookies.username}`);
  } else if (req.cookies.username == "") {
    res.render("login");
  } else {
    res.render("login");
  }
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username == "" && password == "") {
    res.send("username or password is empty");
  } else {
    db.all(
      `select * from users where username = '${username}'`,
      (err, rows) => {
        if (rows.length == 0) {
          res.send("username or password incorrect");
        } else {
          if (username === rows[0].username && password === rows[0].password) {
            res.cookie("username", `${username}`);
            res.redirect(`/user/${username}`);
          } else {
            res.send("username or password incorrect");
          }
        }
      }
    );
  }
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", (req, res) => {
  const { email, password, username } = req.body;
  if (email == "" && username == "" && password == "") {
    res.send("all inputs are required");
  } else {
    if (password[0] === password[1]) {
      db.all(
        `select * from users where username = '${username}'`,
        (err, usernames) => {
          if (usernames.length == 0) {
            db.all(
              `select * from users where email = '${email}'`,
              (err, emails) => {
                if (emails.length == 0) {
                  db.run(
                    `insert into users (email, password, username) values ('${email}', '${password[0]}', '${username}')`
                  );
                  res.redirect("/login");
                } else {
                  res.send("this email already exist");
                }
              }
            );
          } else {
            res.send("this username already exist");
          }
        }
      );
    } else {
      res.send("password 1  not equal to password 2");
    }
  }
});

app.get("/user/:user", (req, res) => {
  const { username } = req.cookies;
  if (req.params.user == username) {
    db.all(
      `select * from users where username = '${username}'`,
      (err, rows) => {
        db.all(
          `select * from projects where user = '${username}'`,
          (err, projects) => {
            if (rows[0].admin == "true") {
              res.redirect(`/admins/${username}`);
            } else {
              res.render("user", { rows, projects });
            }
          }
        );
      }
    );
  } else {
    db.all(
      `select id, username, email from users where username = '${req.params.user}'`,
      (err, user) => {
        db.all(
          `select * from projects where user = '${req.params.user}'`,
          (err, projects) => {
            res.render("guest", { user, projects });
          }
        );
      }
    );
  }
});

app.get("/admins/:adminName", (req, res) => {
  db.all("select * from users limit 10", (err, users) => {
    db.all("select * from logs limit 10", (err, logs) => {
      db.all("select * from projects limit 10", (err, projects) => {
        db.all(
          `select * from users where username = '${req.params.adminName}'`,
          (err, admins) => {
            const { username } = req.cookies;
            if (admins.length == 0) {
              res.redirect("/login");
            } else if (admins[0].admin == "false") {
              res.redirect("/login");
            } else if (req.params.adminName != req.cookies.username) {
              res.redirect("/login");
            } else {
              res.json({ users, logs, projects });
              console.log(!req.cookies);
            }
          }
        );
      });
    });
  });
});

app.get("/editProfile", (req, res) => {
  const { username } = req.cookies;
  if (!req.cookies.username) {
    res.redirect("/login");
  } else {
    db.all(
      `select * from users where username = '${username}'`,
      (err, rows) => {
        res.render("editProfile", { rows });
      }
    );
  }
});

app.post("/editProfile", (req, res) => {
  const { username, email, password } = req.body;
  db.all(
    `select * from users where username = '${username}'`,
    (err, usernames) => {
      if (usernames.length == 0) {
        db.all(
          `select * from users where email = '${email}'`,
          (err, emails) => {
            if (emails.length == 0) {
              if (password.length < 4) {
                res.send("password length is minimal 4");
              } else {
                db.run(`
                  update users set username = "${username}",
                  email = "${email}",
                  password = "${password}" where username = "${req.cookies.username}"
                `);
                res.cookie("username", username);
                res.redirect(`/user/${req.cookies.username}`);
              }
            } else {
              res.send("this email already exist");
            }
          }
        );
      } else {
        res.send("this username already exist");
      }
    }
  );
});

app.get("/logout", (req, res) => {
  res.clearCookie("username");
  res.redirect("/login");
});

app.get("/addPoject", (req, res) => {
  res.render("newPrject");
});

app.post("/addPoject/", (req, res) => {
  const { name, description } = req.body;
  if (name == "" && description == "") {
    res.send("all inputs are required");
  } else {
    db.run(`
      insert into projects (name, description, user)
      values ('${name}', '${description}', '${req.cookies.username}')
    `);
    res.redirect("/login");
  }
});

app.get("/getAllProjects", (req, res) => {
  db.all("select * from projects", (err, rows) => {
    res.json(rows);
  });
});

app.get("/deleteProject/:delId", (req, res) => {
  db.run(`DELETE FROM projects where id = ${req.params.delId}`);
  res.redirect("/login");
});

app.get("/projectSettings/:id", (req, res) => {
  res.send(req.params.id);
});

app.get("/serarchUser", (req, res) => {
  db.all(
    `select id, username, email from users where username = '${req.query.uName}'`,
    (err, user) => {
      db.all(
        `select * from projects where user = '${req.query.uName}'`,
        (err, projects) => {
          // res.json({user, projects});
          res.render("guest", { user, projects });
        }
      );
    }
  );
});

app.get("/comments/:id", (req, res) => {
  db.all(
    `select * from comments where projectId = "${req.params.id}" ORDER BY ID DESC`,
    (err, comments) => {
      let id = req.params.id;
      res.render("comments", { comments, id });
      // res.json(comments)
    }
  );
});

app.post("/addComment/:id", (req, res) => {
  // res.send(req.body.comment);
  const { username } = req.cookies;
  if (!username) {
    res.send("<h2>you are not logged <br> pleace <a href='/login'> Login </a></h2>");
  } else {
    db.run(
      `insert into comments (user, comment, projectId) values ('${username}', '${req.body.comment}', '${req.params.id}')`
    );
    res.redirect(`/comments/${req.params.id}`);
  }
});

app.get("/deleteAccount/:id/:username", (req, res) => {
  db.run(`delete from users where id = ${req.params.id}`)
  db.run(`delete from comments where user = '${req.params.username}'`)
  db.run(`delete from projects where user = '${req.params.username}'`)
  res.redirect("/logout")
})

app.listen(PORT, console.log(`http://localhost:${PORT}`));
