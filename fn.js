// Utility Functions
function cfg_init() {
  document.getElementById("wrapper").style.setProperty('background-image', 'url("' + cfg_bg_path + '")');
  document.getElementById("blur-bg").style.setProperty('background-image', 'url("' + cfg_bg_blurred_path + '")');
  document.getElementsByTagName("body")[0].style.setProperty('font-family', cfg_font_family);
  $(".password").placeholder = cfg_placeholder;
}

function $(c) { return document.querySelector(c); }

function pad0(n) { return n >= 10 ? n.toString() : "0" + n; }

Date.prototype.getDayOfWeek = function() {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][ this.getDay() ];
};

Date.prototype.getMonthName = function() {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ][this.getMonth()];
};

function get12h(date) {
  if (date.getHours() <= 11)
    return 'am';
  else
    return 'pm';
};

// LightDM Login Class
class Login {
  constructor() {
    this.defaultUser = null;
    this.otherUsers = [];
    this.password = "";

    this.bindInactive();
    this.bindEvents();
    this.setupSessions();
    this.setupUsers();
    this.updateTime();
  }

  // Time
  updateTime() {
    const d = new Date();
    if (cfg_12h == true) {
      if (d.getHours() == 0 || d.getHours() == 12)
        $("#time-text").textContent = `12:${pad0(d.getMinutes())}`;
      else if (d.getHours() > 0 && d.getHours() <= 11)
        $("#time-text").textContent = `${d.getHours()}:${pad0(d.getMinutes())}`;
      else
        $("#time-text").textContent = `${d.getHours() - 12}:${pad0(d.getMinutes())}`;
      $("#ampm-text").textContent = get12h(d);
    } else {
      $("#time-text").textContent = `${pad0(d.getHours())}:${pad0(d.getMinutes())}`;
      $("#ampm-text").textContent = "";
    }
    $("#date-text").textContent = `${d.getDayOfWeek()}, ${d.getMonthName()} ${d.getDate()}`.toLowerCase();
    setTimeout(this.updateTime, 1000);
  }

  // Events
  bindInactive() {
    let interval = 1;
    setInterval(() => {
      if (interval === 4) {
        $("#wrapper").className = "inactive";
        $("#time").className = "inactive";
        interval = 1;
        return;
      }
      interval++;
    }, 1000);

    document.body.onmousemove = document.body.onkeypress = () => {
      $("#wrapper").className = "active";
      $("#time").className = "active";
      interval = 1;
    };
  }

  bindEvents() {
    $("#main-user .avatar").onclick = () => {
      if ($("#alt-users").className === "shown")
        $("#alt-users").className = "hidden";
      else
        $("#alt-users").className = "shown";
    };

    $("#main-user .password").onkeydown = e => {
      if (e.keyCode == 13) {
        if (!lightdm._username)
          lightdm.start_authentication(this.defaultUser.name);
        this.password = $("#main-user .password").value;
      } else {
        $("#main-user .warn").style.display="none";
      }
    };

    // Actions
    $("#poweroff").onclick = () => lightdm.shutdown();
    $("#reboot").onclick = () => lightdm.restart();
    $("#suspend").onclick = () => lightdm.suspend();
    $("#hibernate").onclick = () => lightdm.hibernate();

    if (!lightdm.can_shutdown)   $("#poweroff").style.display="none";
    if (!lightdm.can_restart)    $("#reboot").style.display="none";
    if (!lightdm.can_suspend)    $("#suspend").style.display="none";
    if (!lightdm.can_hibernate)  $("#hibernate").style.display="none";
    if (!lightdm.can_shutdown && !lightdm.can_restart &&
      !lightdm.can_suspend && !lightdm.can_hibernate) {
        $("#actions").style.display="none";
    }
  }

  // Users
  setupUsers() {
    this.updateDefault(-1);
  }

  updateDefault(idx) {
    if (lightdm._username)
      lightdm.cancel_authentication();
    lightdm.cancel_timed_login();

    $("#alt-users").className = "hidden";
    if(idx === -1) {
      if (lightdm.select_user_hint)
          this.defaultUser = lightdm.users.find(user => user.username === lightdm.select_user_hint);
      else
          this.defaultUser = lightdm.users[0];
    } else {
      this.defaultUser = this.otherUsers[idx];
    }

    if (this.defaultUser.session) {
      for (let i = 0; i < lightdm.sessions.length; i++) {
        if (lightdm.sessions[i].key === this.defaultUser.session) {
            this.changeSession(i);
            break;
        }
      }
    } else {
      this.changeSession(0);
    }

    // leaving this hack untouched for now
    // HACK: lightdm produces duplicate users for some reason
    const userHash = {};
    this.otherUsers = [];
    for (let user of lightdm.users) {
      if ( user.username !== this.defaultUser.username &&
          !userHash.hasOwnProperty(user.username) ) {
            this.otherUsers.push(user);
            userHash[user.username] = true;
      }
    }
    lightdm.start_authentication(this.defaultUser.username);

    // Main user
    $("#main-user h1").textContent = this.defaultUser.display_name;
    $("#main-user .avatar").style.backgroundImage = "url(\""+(this.defaultUser.image|| "./im-user.svg")+"\")";
    $(".password").value="";
    $(".password").focus();
    $("#main-user .warn").style.display = "none";

    // Others
    let html = "";
    for (let i = 0; i < this.otherUsers.length; i++) {
      const user = this.otherUsers[i];
      html += `
      <div class="user" onClick="window.login.updateDefault(${i});">
          <div class="background"></div>
          <div style='display:table-cell; vertical-align: bottom;'>
              <div class="avatar" style="background-image:url('${user.image || "./im-user.svg"}');"></div>
          </div>
          <div style='display:table-cell; vertical-align: middle;'>
              <h1>${user.display_name}</h1>
          </div>
      </div>
      `;
    }
    $("#alt-users").innerHTML = html;
  }

  // Sessions
  setupSessions() {
    let html = "";
    for (let i = 0; i < lightdm.sessions.length; i++) {
      const session = lightdm.sessions[i];
      html+=`<li data-idx="${i}" onclick="window.login.changeSession(${i});">${session.name}</li>`;
    }
    $("#session-bar .container").innerHTML = html;
    $("#session-bar .container li:first-child").classList.add("active");
  }

  changeSession(idx) {
    $("#session-bar .container li.active").classList.remove("active");
    $(`#session-bar .container li[data-idx="${idx}"]`).classList.add("active");
  }
}

// LightDM Authentication & Login
function authentication_complete() {
  console.log("complete?");
  if (lightdm.is_authenticated)
    lightdm.login(lightdm.authentication_user, lightdm.sessions[parseInt($("#session-bar .active").dataset.idx)].key);
  else if (window.login.password) {
    $("#main-user .warn").style.display = "block";
    $("#main-user .warn").textContent = "try again?";
  }
}

function show_message(msg) {
  $("#main-user .warn").textContent = err;
  $("#main-user .warn").style.display = "block";
}

function show_error() {
  console.log("error");
}

function show_prompt(text, type) {
if (text === "Password: ")
  lightdm.respond(window.login.password);
}

__lightdm.then(result => {
  window.lightdm = result;
  window.login = new Login();
});

cfg_init();