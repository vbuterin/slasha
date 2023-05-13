// target frames per second
const FIELDW = 40;
const FIELDH = 30;
const CELLSIZE = 15;
window.onload = init;
var canvas = null;
var context = null;
//Secondary images
var grass = new Image();
grass.src = 'images/grass.jpg';
var rock = new Image();
rock.src = 'images/rock.jpg';
var garbage = new Image();
garbage.src = 'images/garbage.png';
var plus = new Image();
plus.src = 'images/plus.png';
var minus = new Image();
minus.src = 'images/minus.png';
//Keyboard handling
window.onkeydown = keydown;
window.onkeyup = keyup;
//Mouse handling
window.onmousemove = getmousexy;
window.onmousedown = onclick;
window.onmouseup = release;
var mousex = 0;
var mousey = 0;
var clickx = 0;
var clicky = 0;
var mousedown = 0;
var shiftdown = 0;
var selected = {};
//Menu
const VCENTER = 250;
var menu;
var areyousure_menu;
var menu_shown = 0;
const VTOPMENU = 30;
const VBOTTOMMENU = 480;
const TABWIDTH = 100;
//Lists and maps
var unitlist = [];
var eventlist = [];
var classlist = [];
var class_template = {"side":1,"aitype":1,"damage":10,"health":100,"range":1.6,"image":"Soldier.png","speed":0.1,"desc":"","cmult":0.75,"bmult":0.6,"inacc":0};
var terrain = [];
var undo = "terrain";
var removed_setup = [];
var prev_terrain = [];
//Campaign data
//CAMPAIGN DATA HERE
//Variables concerning editing
var insertmode = 0;
var insertstring = "";
var insertcallback = function() { };
var insert_onadd = function() { };
var insert_oncancel = function() { };
var temp = "";
var brush = 50;
var class_selected = 0;
const TERRAIN = 0;
const CLASSES = 1;
const UNITS = 2;
const DONE = 3;
var editing_type = TERRAIN;
var do_nothing = function() { };
function Field (x,y,value) {
  if (!value) var value = 0;
  var arr = new Array(x);
  for (var i = 0; i < x; i++) {
    arr[i] = new Array(y);
    for (var j = 0; j < y; j++) {
      arr[i][j] = value;
    }
  }
  return arr;
}
function Copy (field) {
  if (!value) var value = 0;
  var arr = [];
  for (var i = 0; i < field.length; i++) {
    arr[i] = field[i].slice(0);
  }
  return arr;
}
var accessible = Field(40,30);
function getang(x1,y1,x2,y2) { //From (x1,y1) to (x2,y2)
  var d = dist(x1,y1,x2,y2);
  if (x2 > x1) return Math.acos((y1 - y2) / d);
  else return Math.PI * 2 - Math.acos((y1 - y2) / d);
}
var point_dmap_cache = Field(FIELDW,FIELDH);
function dist (x1,y1,x2,y2) {
  return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}
function los(x1,y1,x2,y2) {
  var steps = Math.floor(dist(x1,y1,x2,y2) * 1.5);
  var x_increment = (x2 - x1) / steps;
  var y_increment = (y2 - y1) / steps;
  var curx = x1 + 0.5;
  var cury = y1 + 0.5;
  for (var i = 0; i <= steps; i++) {
    if (terrain[Math.floor(curx)][Math.floor(cury)] == 0) return -1;
    curx += x_increment;
    cury += y_increment;
  }
  return 1;
}
function partway_to(x,y,fx,fy,d) {
  var fulld = dist(x,y,fx,fy);
  if (fulld <= d) return [fx,fy];
  else return [x + (fx - x) / fulld * d, y + (fy - y) / fulld * d];
}
function Unit(uclass,xcor,ycor,pointer) {
  //Copy in uclass characteristics
  this.uclass = uclass;
  for (t in classlist[uclass][1]) this[t] = classlist[uclass][1][t];
  this.pic = new Image();
  if (classlist.length > uclass)
    this.pic.src = (classlist[uclass][1].image.indexOf('/') == -1 ? "images/" : "") +classlist[uclass][1].image;
  else this.pic.src = "images/Soldier.png";
  this.pic.onerror = function() { this.src = "images/Soldier.png"; };
  //Initialize position
  this.x = xcor;
  this.y = ycor;
  this.pointer = pointer;
}
function generate_unitlist() {
  unitlist = [];
  for (var i = 0; i < eventlist.length; i++) {
    var e = eventlist[i];
    var pos = 0;
    for (pos = 0; pos < classlist.length; pos++) {
      if (classlist[pos][0] == e[1]) break;
    }
    if (e[0] == "unit") unitlist.push(new Unit(pos,parseFloat(e[2]),parseFloat(e[3]),i));
  }
}
function draw_terrain() {
  var tempcanvas = document.createElement('canvas');
  tempcanvas.width = canvas.width;
  tempcanvas.height = canvas.height;
  var tempcontext = tempcanvas.getContext('2d');
  var image = {true:grass,false:rock};
  var draw_area = function(x,y,w,h,t) {
    tempcontext.drawImage(image[t > 0],(x * CELLSIZE) % 75,(y * CELLSIZE) % 75,w * CELLSIZE,h * CELLSIZE,x * CELLSIZE,y * CELLSIZE,w * CELLSIZE,h * CELLSIZE);
    if (t > 0) {
      var shade = t * 0.0075 - 0.3;
      if (shade > 0) tempcontext.fillStyle = "rgba(96,255,96,"+shade+")";
      else tempcontext.fillStyle = "rgba(0,0,0," + (0 - shade) + ")";
      tempcontext.fillRect(x*CELLSIZE, y*CELLSIZE, w*CELLSIZE, h*CELLSIZE);
    }
  }
  generate_access_map();
  a = accessible;
  for (var i = 0; i < FIELDW; i++) {
    for (var j = 0; j < FIELDH; j++) {
      draw_area(i,j,1,1,terrain[i][j]);
      //Corner rounding - NW
      if (i > 0 && j > 0 && a[i-1][j] != a[i][j] && a[i-1][j-1] != a[i][j] && a[i][j-1] != a[i][j]) {
        draw_area(i,j,0.2,0.067,(terrain[i-1][j] + terrain[i][j-1]) * 0.5);
        draw_area(i,j,0.067,0.2,(terrain[i-1][j] + terrain[i][j-1]) * 0.5);
      }
      //NE
      if (i < FIELDW-1 && j > 0 && a[i+1][j] != a[i][j] && a[i+1][j-1] != a[i][j] && a[i][j-1] != a[i][j]) {
        draw_area(i+0.8,j,0.2,0.067,(terrain[i+1][j]+terrain[i][j-1]) * 0.5);
        draw_area(i+0.933,j,0.067,0.2,(terrain[i+1][j]+terrain[i][j-1])*0.5);
      }
      //SW
      if (i > 0 && j < FIELDH-1 && a[i-1][j] != a[i][j] && a[i-1][j+1] != a[i][j] && a[i][j+1] != a[i][j]) {
        draw_area(i,j+0.8,0.067,0.2,(terrain[i-1][j]+terrain[i][j+1]) * 0.5);
        draw_area(i,j+0.933,0.2,0.067,(terrain[i-1][j]+terrain[i][j+1])*0.5);
      }
      //SE
      if (i < FIELDW-1 && j < FIELDH-1 && a[i+1][j] != a[i][j] && a[i+1][j+1] != a[i][j] && a[i][j+1] != a[i][j]) {
        draw_area(i+0.933,j+0.8,0.067,0.2,(terrain[i+1][j]+terrain[i][j+1])*0.5);
        draw_area(i+0.8,j+0.933,0.2,0.067,(terrain[i+1][j]+terrain[i][j+1])*0.5);
      }
    }
  }
  var bgurl = tempcanvas.toDataURL();
  background = new Image();
  background.src = bgurl;
}
function init()
{
  canvas = document.getElementById('canvas');
  context = canvas.getContext('2d');
  //TIME START HERE
  //This js file is not read directly, first the python script inserts the terrain, unitlist and other important stuff
  level = unpack_level();
  terrain = level.terrain;
  prev_terrain = Copy(terrain);
  draw_terrain();
  classlist = [];
  classes = level.classes;
  for (uclass in classes) classlist.push([uclass,classes[uclass]]);
  update_secondary_class_lists();
  setup = [];
  eventlist = [];
  eventlist = level.events;
  generate_unitlist();
  story = level.story;
  // Put our terrain, story, classes and events into the textboxes
  textify();
  //Hide uninteresting html elements
  var textareas = document.getElementsByTagName('textarea');
  for (var i = 0; i < textareas.length; i++) textareas[i].style.display = 'none';
  document.getElementById('ctrlreminder').style.display = 'none';
  document.getElementsByName('data')[0].style.display = 'inline';
  //Save changes menu
  areyousure_menu = new Menu(canvas,"Save changes?");
  areyousure_menu.add_element('Cancel',function() { editing_type = UNITS });
  areyousure_menu.add_element('Yes',function() {
    document.getElementsByName("info")[0].value = campaign + " " + counter + " save";
    document.forms["play"].submit();
  });
  areyousure_menu.add_element('No',function() {
    document.getElementsByName("info")[0].value = campaign + " " + counter + " nosave";
    document.forms["play"].submit();
  });
  menu = new Menu(canvas);
  setInterval(draw, 5);
}
function update_secondary_class_lists() {
  for (var i = 0; i < classlist.length; i++) {
    classlist[i][2] = new Image();
    if (classlist[i][1].image)
      classlist[i][2].src = (classlist[i][1].image.indexOf('/') == -1 ? "images/" : "") + classlist[i][1].image;
    else classlist[i][2].src = "images/Soldier.png";
    classlist[i][2].onerror = function() { this.src = "images/Soldier.png"; };
  }
  for (var i = 0; i < unitlist.length; i++) unitlist[i].pic = classlist[unitlist[i].uclass][2];
}
function leave(form,info) {
  document.getElementsByName('info')[0].value = info;
  if (form == 'startscreen') document.getElementsByName('campaign')[0].value = "";
  document.forms[form].submit();
}
function keydown(e) {
  if (document.activeElement == document.getElementsByName('data')[0]) return; //If we're editing the textbox, stop here
  if (!e) e = window.event;
  if (insertmode == 0) {
    if (e.keyCode == 16 && shiftdown == 0) { //16 = shift
      shiftdown = 1;
      clickx = mousex;
      clicky = mousey;
    }
    if (e.keyCode == 13) { //13 = enter
      if (editing_type == TERRAIN) {
        clickx = mousex;
        clicky = mousey;
        edit_terrain();
      }
      else if (editing_type == UNITS) place_units();
      else if (editing_type == CLASSES || editing_type == DONE) menu.select();
    }
    if (e.keyCode == 70 && editing_type == UNITS) place_units(1);
    if (e.keyCode == 77) { //M for menu
      if (time <= 0) time = 1;
    }
    //Arrow keys control menu
    if (e.keyCode in {38:1,40:1}) {
      if (menu.pos < 0) menu.pos = 0;
      if (menu.pos >= menu.elements.length) menu.pos = menu.elements.length - 1;
      menu.pos += e.keyCode - 39;
      if (menu.pos < 0) menu.pos = 0;
      if (menu.pos >= menu.elements.length) menu.pos = menu.elements.length - 1;
    }
    //Editing
    if (e.keyCode == 73) {
      insertstring = "";
      insertmode = 1;
      insertcallback = function() {
        brush = parseInt(insertstring);
        if (brush < 0) brush = 0;
        if (brush > 99) brush = 99;
      };
      insert_onadd = function() {
        if (editing_type == TERRAIN && insertstring.length == 2) {
          insertmode = 0;
          insertcallback();
        }
      }
    }
    else if (e.keyCode == 89) {
      if (undo == "terrain") {
        terrain = Copy(prev_terrain);
        draw_terrain();
        textify_terrain();
      }
      else if (undo == "-setup") {
        for (var i = eventlist.length - 1; i >= 0; i--) {
          if (eventlist[i][0] == "setup") {
            eventlist[i] = ["none"];
            break;
          }
        }
        textify_events();
      }
      else if (undo == "+setup") {
        eventlist.push(removed_setup.slice(0));
        textify_events();
      }
      undo = "";
    }
    else if (e.keyCode == 84) editing_type = TERRAIN;
    else if (e.keyCode == 67) {
      editing_type = CLASSES;
      class_selected = 0;
    }
    else if (e.keyCode == 85) editing_type = UNITS;
    else if (e.keyCode == 68) editing_type = DONE;
    else if (e.keyCode == 37 && class_selected > 0) class_selected--;
    else if (e.keyCode == 39) {
      if (class_selected == classlist.length - 1) create_new_class();
      else class_selected++;
    }
  }
  //Text insertion
  else if (insertmode == 1) {
    if (e.keyCode == 32 || (e.keyCode >= 48 && e.keyCode <= 57)) {
      insertstring += String.fromCharCode(e.keyCode);
      insert_onadd();
    }
    else if (e.keyCode == 190) {
      insertstring += '.';
      insert_onadd();
    }
    else if (e.keyCode == 189) {
      insertstring += '_';
      insert_onadd();
    }
    else if (e.keyCode >= 65 && e.keyCode <= 90) {
      insertstring += String.fromCharCode(e.keyCode + (1 - shiftdown) * 32);
      insert_onadd();
    }
    else if (e.keyCode == 8 || e.keyCode == 46) {
      if (insertstring.length > 0) {
        insertstring = insertstring.substr(0,insertstring.length - 1);
        insert_onadd();
      }
      else {
        insertmode = 0;
        insert_oncancel();
      }
    }
    else if (e.keyCode == 13) {
      insertmode = 0;
      insertcallback();
    }
    else if (e.keyCode == 16 && shiftdown == 0) shiftdown = 1;
  }
}
function keyup(e) {
  if (!e) e = window.event;
  if (e.keyCode == 16) {
    shiftdown = 0;
    if (editing_type == TERRAIN) edit_terrain();
  }
  //e.keyCode == 37 for a  left arrow, 38 = up arrow, 39 = right arrow, 40 = down arrow
}
function getmousexy(e) {
  MANUALOFFSET_X = -9;
  MANUALOFFSET_Y = -10;
  mousex = e.clientX - canvas.offsetLeft + MANUALOFFSET_X;
  mousey = e.clientY - canvas.offsetTop + MANUALOFFSET_Y;
  if (menu_shown == 1) menu.pos = menu.mousey_to_pos(mousey);
}
function generate_access_map() {
  var a = new Field(FIELDW,FIELDH);
  for (var i = 0; i < FIELDW; i++) {
    for (var j = 0; j < FIELDH; j++) {
      a[i][j] = terrain[i][j] > 0 ? 1 : 0;
    }
  }
  for (var i = 0; i < unitlist.length; i++) {
    a[Math.floor(unitlist[i].x)][Math.floor(unitlist[i].y)] = 0;
  }
  accessible = a;
}
function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
//Normal mode
  //Background
  context.drawImage(background,0,VTOPMENU);
  generate_unitlist();
  //Draw units
  for (var i = 0; i < unitlist.length; i++) {
    var hsize = unitlist[i].pic.width;
    var vsize = unitlist[i].pic.height;
    var ux = unitlist[i].x * CELLSIZE;
    var uy = unitlist[i].y * CELLSIZE + VTOPMENU;
    context.drawImage(unitlist[i].pic,ux + hsize * -0.5,uy + vsize * -0.5,hsize,vsize);
    //Color for healthbar based on aitype
    var colors = {1:"rgb(250,0,0)",2:"rgb(250,128,128)",3:"rgb(250,250,0)",4:"rgb(96,96,96)"}
    if (unitlist[i].aitype in colors) context.fillStyle = colors[unitlist[i].aitype];
    else {
      //If aitype = 0 (computer controlled), randomly generate a color from the unit's side
      var val = unitlist[i].side;
      var col = Math.floor(Math.sqrt(val + 9.175) * 1048576) % 32768;
      var blue = col % 256;
      var green = Math.floor (col / 256);
      var red = 128 - blue + green;
      if (red < 0) red = 0;
      context.fillStyle = "rgb(" + red + "," + green + "," + blue + ")";
    }
    //Draw healthbar
    var h = unitlist[i].health * 0.2;
    var v = 6;
    if (unitlist[i].health >= 300) {
      h = Math.floor(Math.log(unitlist[i].health) * 0.4343) * 5 + 5; //Number of digits * 5
      v = 14;
    }
    if (unitlist[i].health < 300) context.fillRect(ux - h,uy - 14 - v, h * 2,v);
    else context.fillText(Math.floor(unitlist[i].health),ux - h + 2,uy - 16,h * 2 - 5);
    //Draw rectangle around healthbar if selected
    if (unitlist[i].pointer in selected) {
      context.fillStyle = "rgb(0,0,0)";
      context.fillRect(ux - h - 1,uy - v - 15, h * 2 + 2,2);
      context.fillRect(ux - h - 1,uy - 15, h * 2 + 2,2);
      context.fillRect(ux - h - 1,uy - v - 13, 2, v - 2);
      context.fillRect(ux + h - 1,uy - v - 13, 2, v - 2);
    }
  }
  context.fillStyle = "rgba(255,255,0,0.33)";
  for (var i = 0; i < eventlist.length; i += 1) {
    if (eventlist[i][0] == "setup") {
      var e = function(x) { return parseInt(eventlist[i][x]); };
      context.fillRect(e(1) * CELLSIZE,e(2) * CELLSIZE + VTOPMENU,(e(3) - e(1)) * CELLSIZE,(e(4) - e(2)) * CELLSIZE);
    }
  }
  // Show coordinates
  context.textAlign = "right";
  context.fillStyle = "rgb(0,0,0)";
  context.fillText("("+ (mousex/CELLSIZE).toFixed(2) + "," + ((mousey-VTOPMENU)/CELLSIZE).toFixed(2) + ")",595,VBOTTOMMENU-5);
  context.textAlign = "left";
  // Top menu
  if (editing_type == CLASSES || editing_type == UNITS) {
    context.fillStyle = "rgba(128,128,255,0.67)";
    context.fillRect(0,0,600,VTOPMENU);
    for (var i = 0; i < classlist.length; i++) context.drawImage(classlist[i][2],i * 30,0,30,30);
    context.fillRect(class_selected * 30,0,30,VTOPMENU);
    if (editing_type == CLASSES) context.drawImage(plus,classlist.length * 30,0,30,30);
  }
  // Bottom menu
  context.fillStyle = "rgb(0,0,0)";
  context.font = "bold 15px sans-serif";
  menu_shown = 0;
  var left = 600 - TABWIDTH * 4;
  for (var i = 0; i < 3; i++) {
    context.fillStyle = editing_type == i ? "rgb(200,200,228)" : "rgb(128,128,192)";
    context.moveTo(left + i * 90,VBOTTOMMENU);
    context.beginPath();
    context.lineTo(left + TABWIDTH + i * TABWIDTH,VBOTTOMMENU);
    context.lineTo(left - 8 + TABWIDTH + i * TABWIDTH,VBOTTOMMENU + 19);
    context.lineTo(left + 8 + i * TABWIDTH,VBOTTOMMENU + 19);
    context.lineTo(left + i * TABWIDTH,VBOTTOMMENU);
    context.closePath();
    context.fill();
  }
  context.fillStyle = "rgb(192,192,192)";
  context.fillRect(600 - TABWIDTH + 10,VBOTTOMMENU + 3,TABWIDTH - 20,17);
  context.fillStyle = "rgb(0,0,0)";
  context.textAlign = "center";
  context.fillText("Terrain (T)",600 - TABWIDTH * 3.5,VBOTTOMMENU + 15);
  context.fillText("Classes (C)",600 - TABWIDTH * 2.5,VBOTTOMMENU + 15);
  context.fillText("Units (U)",600 - TABWIDTH * 1.5,VBOTTOMMENU + 15);
  context.fillText("Done (D)",600 - TABWIDTH * 0.5,VBOTTOMMENU + 17);
  context.textAlign = "left";
  //Terrain view
  if (editing_type == TERRAIN) {
    //Upper select terrain brush bar
    context.fillStyle = "rgb(170,170,255)";
    context.fillRect(0,0,600,VTOPMENU);
    context.drawImage(rock,0,0,30,VTOPMENU,135,0,30,VTOPMENU - 2);
    for (var i = 165; i < 600; i += 75) {
      context.drawImage(grass,0,0,75,VTOPMENU,i,0,75,VTOPMENU - 2);
    }
    for (var i = 0; i < 25; i++) {
      var shade = (i * 4 + 2) * 0.0075 - 0.3;
      if (shade > 0) context.fillStyle = "rgba(96,255,96,"+shade+")";
      else context.fillStyle = "rgba(0,0,0," + (0 - shade) + ")";
      context.fillRect(165 + i * 15,0,15,VTOPMENU - 2);
    }
    if (brush != "setup" && brush > 0) {
      context.fillStyle = "rgb(255,0,0)";
      context.fillRect((brush * 3.75) + 165,0,2,VTOPMENU - 2);
    }
    context.fillStyle = "rgba(255,255,0,0.6)";
    context.fillRect(540,0,60,VTOPMENU - 2);
    context.drawImage(minus,571,0,28,28);
    //Lower bar text for editing terrain
    context.fillStyle = "rgb(0,0,0)";
    var text = "Terrain brush (I): ";
    context.textBaseline = "middle";
    context.fillText(text + (insertmode == 1 ? (insertstring + "...") : brush),5,VTOPMENU * 0.5 - 1);
    context.textBaseline = "alphabetic";
  }
  //Class view
  if (editing_type == CLASSES) {
    if (class_selected < classlist.length) {
      var atts = [];
      menu.toptext = classlist[class_selected][0];
      for (attribute in classlist[class_selected][1]) atts.push(attribute);
      for (var i = 0; i < atts.length; i++) {
        menu.elements[i] = new MenuElement(atts[i] + ": " + classlist[class_selected][1][atts[i]], function() {
          insertmode = 1;
          insertstring = "";
          temp = [atts[menu.pos],classlist[class_selected][1][atts[menu.pos]]];
          classlist[class_selected][1][temp[0]] = "...";
          insert_onadd = function() { classlist[class_selected][1][temp[0]] = insertstring + "..."; };
          insert_oncancel = function() { classlist[class_selected][1][temp[0]] = temp[1]; };
          insertcallback = function() {
            if (atts[menu.pos] == "desc" || atts[menu.pos] == "image") classlist[class_selected][1][temp[0]] = insertstring;
            else classlist[class_selected][1][temp[0]] = parseFloat("0" + insertstring);
            update_secondary_class_lists();
            for (var i = 0; i < unitlist.length; i++) unitlist[i].health = classlist[unitlist[i].uclass][1].health;
            textify_classes();
          }
        });
      }  
      menu.elements[atts.length] = new MenuElement("Delete this class", function() {
        for (var i = 0; i < eventlist.length; i++) {
          var e = eventlist[i];
          if (e[0] == "unit" && e[1] == classlist[class_selected][0]) eventlist[i] = ["none"];
        }
        classlist.splice(class_selected,1);
        generate_unitlist();
        update_secondary_class_lists();
        textify_events();
        textify_classes();
        if (class_selected > 0) class_selected--;
        if (classlist.length == 0) create_new_class();
      });
      menu.draw("left");
    }
    else {
      menu = new Menu(canvas,"New class");
      menu.add_element(new MenuElement("Class name: " + insertstring + "..."));
      menu.draw();
    }
    menu_shown = 1;
  }
  else if (editing_type == UNITS) {
    var count = 0;
    var cl = -1;
    for (var i = 0; i < unitlist.length; i++) {
      if (unitlist[i].pointer in selected) {
        count++;
        if (unitlist[i].uclass != cl) {
          if (cl == -1) cl = unitlist[i].uclass;
          else cl = -2;
        }
      }
    }
    if (cl >= 0) class_selected = cl;
    if (count > 0) {
      context.textBaseline = "middle";
      context.drawImage(garbage,0,VBOTTOMMENU,20,20);
      context.fillText("Move units here to delete",20,VBOTTOMMENU + 10);
      context.textBaseline = "alphabetic";
    }
  }
  if (editing_type == DONE) {
    menu_shown = 1;
    menu = areyousure_menu;
    menu.draw();
  }
  //On top of everything, draw the selection rectangle
  if ((mousedown == 2 || shiftdown == 1) && menu_shown == 0) {
    context.fillStyle = "rgb(0,0,255)";
    context.fillRect(clickx,clicky - 1,mousex - clickx,2);
    context.fillRect(clickx,mousey - 1,mousex - clickx,2);
    context.fillRect(clickx - 1,clicky,2,mousey - clicky);
    context.fillRect(mousex - 1,clicky,2,mousey - clicky);
    select_targets();
  }
  else if (menu_shown) for (var i = 0; i < unitlist.length; i++) unitlist[i].selected = 0;
}
function create_new_class() {
  class_selected = classlist.length;
  insertmode = 1;
  insertstring = "";
  insertcallback = function() {
    classlist.push([insertstring,{}]);
    for (s in class_template) classlist[classlist.length - 1][1][s] = class_template[s];
    update_secondary_class_lists();
    class_selected = classlist.length - 1;
    textify_classes();
  }
}
function onclick(e) {
  if (document.activeElement == document.getElementsByName('data')[0]) return; //If we're editing the textbox, stop here
  if (insertmode == 1) {
    insertmode = 0;
    insertcallback();
  }
  else {
    clickx = mousex;
    clicky = mousey;
    mousedown = e.button;
    if (clicky > VBOTTOMMENU && clickx > (600 - TABWIDTH * 4) && insertmode == 0) {
      editing_type = Math.floor((clickx - (600 - TABWIDTH * 4)) / TABWIDTH);
      if (editing_type == CLASSES) class_selected = 0;
    }
    else if (clicky < VTOPMENU) {
      if (editing_type == TERRAIN) {
        if (clickx < 135) do_nothing();
        else if (clickx < 165) brush = 0;
        else if (clickx < 540) brush = Math.floor((clickx - 165) / 3.75);
        else if (clickx < 570) brush = "setup";
        else {
          for (var i = eventlist.length - 1; i >= 0; i--) {
            if (eventlist[i][0] == "setup") {
              removed_setup = eventlist[i].slice(0);
              undo = "+setup";
              eventlist[i] = ["none"];
              break;
            }
          }
          textify_events();
        }
      }
      else {
        if (clickx < classlist.length * 30) class_selected = Math.floor(clickx / 30);
        else if (clickx < classlist.length * 30 + 30 && editing_type == CLASSES) create_new_class();
      }
    }
    else {
      if (menu_shown == 1 && clickx > 0 && clickx < canvas.width) menu.select();
      if (mousedown == 1 && editing_type == TERRAIN) edit_terrain();
      else if (editing_type == UNITS && mousedown < 2) place_units(mousedown);
    }
  }
}
function edit_terrain() {
  if (editing_type != TERRAIN) return;
  var left = Math.floor(Math.min(clickx / CELLSIZE,mousex / CELLSIZE));
  var right = Math.ceil(Math.max(clickx / CELLSIZE,mousex / CELLSIZE));
  var up = Math.floor(Math.min((clicky - VTOPMENU) / CELLSIZE,(mousey - VTOPMENU) / CELLSIZE));
  var down = Math.ceil(Math.max((clicky - VTOPMENU) / CELLSIZE,(mousey - VTOPMENU) / CELLSIZE));
  if (left < 0 || right > FIELDW || up < 0 || down > FIELDH) return;
  if (brush == "setup") {
    eventlist.push(["setup",left,up,right,down]);
    textify_events();
    undo = "-setup";
  }
  else {
    undo = "terrain";
    prev_terrain = Copy(terrain);
    for (var x = left; x < right; x++) {
      for (var y = up; y < down; y++) {
        terrain[x][y] = brush;
      }
    }
    draw_terrain();
    textify_terrain();
  }
}
function place_units(in_formation) {
  var mx = Math.floor(mousex / CELLSIZE);
  var my = Math.floor((mousey - VTOPMENU) / CELLSIZE);
  if (!in_formation) var in_formation = 0;
  var sumx = 0;
  var sumy = 0;
  var count = 0;
  //Find average coordinates of selected units
  for (s in selected) {
      sumx += eventlist[s][2];
      sumy += eventlist[s][3];
      count += 1;
  }
  if (count > 0) {
    var dx = mx - Math.floor(sumx / count);  
    var dy = my - Math.floor(sumy / count);  
  }
  for (s in selected) {
    var e = eventlist[s];
    if (in_formation == 1) {
      dfx = Math.floor(parseInt(e[2]) + dx);
      dfy = Math.floor(parseInt(e[3]) + dy);
    }
    else {
      dfx = mx;
      dfy = my;
    }
    if (dfx >= 0 && dfy >= 0 && dfx < FIELDW && dfy < FIELDH && accessible[dfx][dfy]) {
      e[2] = "" + (dfx + 0.5)
      e[3] = "" + (dfy + 0.5)
      delete selected[s];
      if (in_formation == 0) break;
    }
    //Dump unit into garbage
    else if (dfy >= FIELDH) {
      eventlist[s] = ["none"];
      delete selected[s];
      if (in_formation == 0) break;
    }
  }
  //Add new unit
  if (count == 0 && in_formation == 0 && class_selected >= 0 && class_selected < classlist.length) {
    var x = mousex / CELLSIZE;
    var y = (mousey - VTOPMENU) / CELLSIZE;
    if (accessible[Math.floor(x)][Math.floor(y)]) {
      eventlist.push(['unit',classlist[class_selected][0],(mousex / CELLSIZE).toFixed(3),((mousey-VTOPMENU)/CELLSIZE).toFixed(3)]);
    }
  }
  textify_events();
  generate_unitlist();
  generate_access_map();
}
function select_targets() {
  var count = 0;
  for (var i = 0; i < unitlist.length; i++) {
    if ((unitlist[i].x * CELLSIZE - clickx) * (unitlist[i].x * CELLSIZE - mousex) < 0 && (unitlist[i].y * CELLSIZE + VTOPMENU - clicky) * (unitlist[i].y * CELLSIZE + VTOPMENU - mousey) <= 0) {
      selected[unitlist[i].pointer] = 1;
      count += 1;
    }
    else delete selected[unitlist[i].pointer];
  }
  if (count == 0) {
    var closest = -1;
    var mindist = FIELDW + FIELDH;
    for (var i = 0; i < unitlist.length; i++) {
      var d = dist(unitlist[i].x * CELLSIZE,unitlist[i].y * CELLSIZE,mousex,mousey - VTOPMENU);
      if (d < mindist) {
        mindist = d;
        closest = i;
      }
    }
    if (closest >= 0) selected[unitlist[closest].pointer] = 1;
  }
}
function release(e) {
  mousedown = 0;
  if (editing_type == TERRAIN) edit_terrain();
}
