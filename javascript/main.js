// target frames per second
const FIELDW = 40;
const FIELDH = 30;
const CELLSIZE = 15;
var canvas = null;
var context = null;
//Secondary images
var grass = new Image();
grass.src = '../../images/grass.jpg';
var rock = new Image();
rock.src = '../../images/rock.jpg';
var garbage = new Image();
garbage.src = '../../images/garbage.png';
var plus = new Image();
plus.src = '../../images/plus.png';
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
//Framerate timing
var msperframe = 40;
var last_update = 0;
var last_frame_length = 0;
var realtime = 0;
//Game clock
var time = 0;
//Game state
var gamestate = 0;
const PLAYING = 0;
const PAUSED = 1;
var menu = null;
var pause_menu, highscore_menu, controls_menu, areyousure_menu, win_menu;
var menu_shown = 0;
var your_ratio, best_ratio;
const HIGHSCORE = 2;
const CONTROLS = 3;
const WIN = 4;
const AREYOUSURE = 5;
//Force wins/losses
var forcewin = 0;
//Debug/optimization purposes only
var debug_vars = [0,0,0,0,0];
//Lists and maps
var unitlist = [];
var eventlist = [];
var registerlist = {};
var classlist = [];
var class_template = {"side":1,"aitype":1,"damage":8,"health":50,"range":25,"image":"Archer.png","speed":0.067,"desc":"","cmult":0.75,"bmult":0.6,"inacc":0};
var classpics = {};
var ROTATES = 32;
var rotates_caching_at = 1;
var attacklist = [];
var threat_map = [];
var opportunity_map = [];
var wall_proximity_map = [];
var id_lookup = [];
var result = [];
var do_nothing = function() { };
window.onload = init;

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
var occupied = Field(40,30);
function getang(x1,y1,x2,y2) { //From (x1,y1) to (x2,y2)
  var d = dist(x1,y1,x2,y2);
  if (x2 > x1) return Math.acos((y1 - y2) / d);
  else return Math.PI * 2 - Math.acos((y1 - y2) / d);
}
var los_cache = new Array(FIELDW * FIELDH * FIELDW * FIELDH);
var point_dmap_cache = Field(FIELDW,FIELDH);
function dist (x1,y1,x2,y2) {
  return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}
function los(x1,y1,x2,y2) {
  var a =los_cache[y2 + x2*FIELDH + y1*FIELDW*FIELDH + x1*FIELDH*FIELDW*FIELDH];
  if (a != undefined) return a;
  var steps = Math.floor(dist(x1,y1,x2,y2) * 1.5);
  var x_increment = (x2 - x1) / steps;
  var y_increment = (y2 - y1) / steps;
  var curx = x1 + 0.5;
  var cury = y1 + 0.5;
  for (var i = 0; i <= steps; i++) {
    if (terrain[Math.floor(curx)][Math.floor(cury)] == 0) {
      los_cache[y2 +x2*FIELDH +y1*FIELDW*FIELDH +x1*FIELDH*FIELDW*FIELDH] = -1;
      los_cache[y1 +x1*FIELDH +y2*FIELDW*FIELDH +x2*FIELDH*FIELDW*FIELDH] = -1;
      return -1;
    }
    curx += x_increment;
    cury += y_increment;
  }
  los_cache[y2 + x2*FIELDH + y1*FIELDW*FIELDH + x1*FIELDH*FIELDW*FIELDH] = 1;
  los_cache[y1 + x1*FIELDH + y2*FIELDW*FIELDH + x2*FIELDH*FIELDW*FIELDH] = 1;
  return 1;
}
function partway_to(x,y,fx,fy,d) {
  var fulld = dist(x,y,fx,fy);
  if (fulld <= d) return [fx,fy];
  else return [x + (fx - x) / fulld * d, y + (fy - y) / fulld * d];
}
function Unit(uclass,xcor,ycor,strict) {
  //Copy in class characteristics
  this.uclass = uclass;
  for (s in class_template) {
    if(!(s in classlist[uclass])) classlist[uclass][s] = class_template[s];
    this[s] = classlist[uclass][s];
  }
  this.pic = new Image();
  this.pic.src = (classlist[uclass].image.indexOf('/') == -1 ? "../../images/" : "") + classlist[uclass].image;
  this.pic.onerror = function() { this.src = "../../images/Soldier.png"; };
  //Initialize angle and combat variables
  this.attack_in = 12;
  this.in_combat = 0;
  this.ang = 0;
  //Give it a unique id; remember to only add units to the end for this to work
  this.id = 1;
  if (unitlist.length > 0) this.id = unitlist[unitlist.length - 1].id + 1;
  //The unit's status with regard to player selection and targeting
  this.selected = 0;
  this.targeted = 0;
  //This is the core of pathfinding - a unit finds its path by going to the lowest adjacent spot on a map representing distance to the nearest objective
  this.dmap = Field(FIELDW,FIELDH);
  //Calculate LOS and distance from unit to all points; useful to do this once rather than every time it's needed for optimization purposes
  this.losmap = Field(FIELDW,FIELDH);
  this.update_losmap = function() {
    for (var i = 0; i < FIELDW; i++) {
      for (var j = 0; j < FIELDH; j++) {
        if (los(this.nx,this.ny,i,j) == 1) this.losmap[i][j] = dist(this.nx,this.ny,i,j);
        else this.losmap[i][j] = 9999;
      }
    }
  }
  this.setpos = function(x,y) {
    var floorx = Math.floor(x);
    var floory = Math.floor(y);
    this.x = x;
    this.y = y;
    if (this.nx != floorx || this.ny != floory) {
      if (this.nx && this.ny) occupied[this.nx][this.ny] = 0;
      this.nx = Math.floor(this.x);
      this.ny = Math.floor(this.y);
      occupied[floorx][floory] = this.id;
      this.update_losmap();
    }
  }
  //Initialize position, trying to summon units to an unoccupied square unless 'strict' flag is turned on
  var xc = Math.floor(xcor);
  var yc = Math.floor(ycor);
  var done = 0;
  for (var range = 0; range <= strict ? 2 : 0 && !done; range++) {
    for (var i = xc - range; i <= xc + range && !done; i++) {
      for (var j = yc - range; j <= yc + range && !done; j++) {
        if (i >= 0 && i < FIELDW && j >= 0 && j < FIELDH && occupied[i][j] == 0 && los(xc,yc,i,j)) {
          this.setpos(i + 0.5, j + 0.5);
          done = 1;
        }
      }
    }
  }
  if (!done) this.setpos(xcor,ycor);
  this.ai = function() {
    //AITYPES: 0 = computer controlled, 1 = player controlled, minimal automovement, 2 = player controlled, stand guard, 3 = player controlled, like 2 but no attacking (ie. flee mode), 4 = player owner but temporarily computer controlled
    final_dmap = new Field(FIELDW,FIELDH,0);
    for (var i = 0; i < FIELDW; i++) {
      for (var j = 0; j < FIELDH; j++) {
        final_dmap[i][j] = this.dmap[i][j] + 1 - (occupied[i][j] == 0 ? 1 : 0);
        if (threat_map[this.side][i][j] > 0) final_dmap[i][j] += 0.5;
      }
    }
    //The cell the unit itself is on is not inaccessible to the unit despite what the access map says; correct for this
    final_dmap[this.nx][this.ny] -= 1; 
    //Separate loop to avoid wasting time; here, if the unit is at its destination and an opportunity appears beside it, the unit advances; this prevents an enemy pikeman from passively killing a forgotten unit from range
    if (this.aitype == 1 && final_dmap[this.nx][this.ny] < 1) {
      for (var i = Math.max(this.nx - 1,0); i < Math.min(this.nx + 1,FIELDW); i++) {
        for (var j = Math.max(this.ny - 1,0); j < Math.min(this.ny + 1,FIELDH); j++) {
          if (opportunity_map[this.side][i][j] < this.range) {
            final_dmap[i][j] = -3;
          }
        }
      }
    }
    this.move(final_dmap);
  }
  this.move = function(dmap) {
    var destx = this.x;
    var desty = this.y;
    options = []
    options.push([0,0]);
    if (this.ny > 0) options.push([0,-1]);
    if (this.ny < FIELDH - 1) options.push([0,1]);
    if (this.nx > 0) {
      options.push([-1,0]);
      if (this.ny > 0) options.push([-1,-1]);
      if (this.ny < FIELDH - 1) options.push([-1,1]);
    }
    if (this.nx < FIELDW - 1) {
      options.push([1,0]);
      if (this.ny > 0) options.push([1,-1]);
      if (this.ny < FIELDH - 1) options.push([1,1]);
    }
    var best = 0;
    var best_score = 0;
    var scores = [];
    for (var i = 0; i < options.length; i++) {
      var mult = 1;
      if (options[i][0] * options[i][1] != 0) mult = 0.75;
      var score = (dmap[this.nx + options[i][0]][this.ny + options[i][1]] - dmap[this.nx][this.ny]) * mult;
      scores[i] = score;
      if (score < best_score) {
        best_score = score;
        best = i;
      }
    }
    this.options = options;
    //Combat movement penalty
    if (this.in_combat) var v = this.speed * this.cmult;
    else var v = this.speed; 
    //Backward movement penalty
    if (options[best][0] != 0 || options[best][1] != 0) {
      var ang = getang(0,0,options[best][0],options[best][1]);
      var dif = Math.abs(this.ang - ang);
      if (dif > Math.PI) dif = 2 * Math.PI - dif;
      v *= (1 - (1 - this.bmult) * dif / Math.PI);
    }
    //Calculate exactly where we move to
    var d = partway_to(this.x,this.y,this.nx + 0.5 + options[best][0],this.ny + 0.5 + options[best][1],v);
    destx = d[0];
    desty = d[1];
    var fmapx = Math.floor(destx);
    var fmapy = Math.floor(desty);
    if ((fmapx != this.nx || fmapy != this.ny) && (fmapx < 0 || fmapy < 0 || fmapx >= FIELDW || fmapy >= FIELDH || occupied[fmapx][fmapy] != 0)) {
      if (fmapy >= 0 && fmapy < FIELDH && (occupied[this.nx][fmapy] == 0 || fmapy == this.ny)) destx = this.x;
      else if (fmapx >= 0 && fmapx < FIELDW && (occupied[fmapx][this.ny] == 0 || fmapx == this.nx)) desty = this.y;
      else {
        destx = this.x;
        desty = this.y;
      }
    }
    //Adjust the direction the unit is facing
    if (destx != this.x || desty != this.y) {
      var target_ang = getang(this.x,this.y,destx,desty);
      if (Math.abs(this.ang - target_ang) < 0.0725 || Math.abs(this.ang - target_ang) > 6.2106) this.ang = target_ang; 
      else if (this.ang > target_ang && this.ang - target_ang < Math.PI || this.ang < target_ang - Math.PI) this.ang -= 0.0725; //5 degrees
      else this.ang += 0.0725;
    }
    fmapx = Math.floor(destx);
    fmapy = Math.floor(desty);
    this.setpos(destx,desty);
  }
  this.getvictim = function() {
    var best_priority = 0;
    var best_unit = -1;
    var best_target_dmg = {};
    //We compare the units as if they were in the centers of their squares; makes things more consistent
    for (var i = 0; i < unitlist.length; i++) {
      if (unitlist[i].side != this.side) {
        var tx = unitlist[i].nx;
        var ty = unitlist[i].ny
        var d = this.losmap[tx][ty];
        if (d < this.range) {
          var inacc = Math.min(Math.floor(d * 0.5),this.inacc)
          var priority = 0;
          var target_dmg = {};
          for (var j = 0 - inacc; j <= inacc; j++) {
            var dest = partway_to(tx + 0.5,ty + 0.5,this.nx + 0.5,this.ny + 0.5,j);
            var dx = Math.floor(dest[0]);
            var dy = Math.floor(dest[1]);
            if (dx >= 0 && dx < FIELDW && dy >= 0 && dy < FIELDH && this.losmap[dx][dy] <this.range && occupied[dx][dy] > 0) {
              var v = id_lookup[occupied[dx][dy]];
              //Here's our damage calculating algorithm - first, we check if the target has an ally right in front of it
              var dmg = 0;
              var slopedif = terrain[this.nx][this.ny] - terrain[dx][dy];
              var higher = -1;
              if (slopedif > 0) higher = 1;
              //At minimum distance (d + 1 = 2), slope multiplier is 1 +/- sqrt(100 / 2) * 0.1 = 0.29 to 1.71
              var slopemult = 1 + Math.sqrt(Math.abs(slopedif) / (d + 1)) * 0.1 * higher;
              //Angle calculations -we'll make these insignificant at long distances
              var angdif = Math.abs(getang(dx,dy,this.nx,this.ny) - unitlist[v].ang);
              if (angdif > Math.PI) angdif = 2 * Math.PI - angdif;
              var angmult = 1 + (angdif - Math.PI*0.5) * 2 / (d + 1) / Math.PI;
              //Gives us a pyramid distribution of damage for inaccurate units - 121, 12321, etc
              var inaccmult = (inacc+1 - Math.abs(j)) / ((inacc+1) * (inacc+1));
              dmg = this.damage * slopemult * angmult * inaccmult;
              //Priority is based on how much damage you can deal to that unit, but ensures focus fire (encourages targeting low hp units) and as a
              //secondary consideration ensures that ranged units attack nearby enemies and ranged units first
              var dist_addition = this.damage * 0.013 / (Math.max(d - unitlist[i].range,0) + 2);
              var p = dmg / (unitlist[v].health * 0.6 + classlist[unitlist[v].uclass].health * 0.4 + 0.01) + dist_addition;
              if (unitlist[v].side == this.side) p *= -1.5; //Friendly fire
              if (this.aitype > 0 && unitlist[i].targeted == 1)
                p = p * 3 + 0.1;
              if (this.aitype > 0 && unitlist[i].targeted == 2)
                p = p * 9 + 0.4;
              if (this.aitype > 0 && unitlist[i].targeted == 3)
                p = p * 27 + 0.9;
              priority += p;
              target_dmg[v] = dmg;
            }
          }
          if (priority > best_priority) {
            best_priority = priority;
            best_unit = i;
            best_target_dmg = target_dmg;
          }
        }
      }
    }
    return [best_unit, best_target_dmg];
  }
}
//Events
function check_conds(condlist) {
  var ul = [];
  for (var i = 0; i < unitlist.length; i++) ul.push(unitlist[i]);
  for (var i = 0; i < condlist.length; i++) {
    var c = condlist[i];
    if (c != "onetime" && c != "none") { //Reserves those words for their specific purposes
      if (c.charAt(0) == "$") {
        var j = 0;
        while (j < ul.length) {
          if (ul[j].desc != c.substring(1)) ul.splice(j,1);
          else j++;
        }
      }
      else if (c.substring(0,2) == "l$") {
        var checked_units = [];
        for (var j = 0; j < ul.length; j++) {
          if (ul[j].desc == c.substring(2)) checked_units.push(ul[j]);
        }
        var j = 0;
        while (j < ul.length) {
          var inlos = 0;
          for (var k = 0; k < checked_units.length; k++) {
            var uj = ul[j];
            var uk = checked_units[k];
            if (los(uj.nx,uj.ny,uk.nx,uk.ny) == 1) {
              inlos = 1;
              break;
            }
          }
          if (inlos == 0) ul.splice(j,1);
          else j++;
        }
      }
      else {
        var mark = 0;
        for (var j = 0; j < c.length; j++) {
          if ("abcdefghijklmnopqrstuvwxyz=<>".indexOf(c.charAt(j)) >= 0) {
            mark = j;
            break;
          }
        }
        var left = parseInt(c.substring(0,mark));
        var right = parseInt(c.substring(mark + 1));
        if (c.charAt(mark) == "t") {
          if (mark == c.length - 1 && time != left) return [];
          if (mark < c.length - 1 && (time - left) % right != 0 || time < left) return [];
        }
        else if (c.charAt(mark) == "=") {
          if (left != right) return [];
        }
        else if (c.charAt(mark) == ">") {
          if (parseFloat(left) <= parseFloat(right)) return [];
        }
        else if (c.charAt(mark) == "<") {
          if (parseFloat(left) >= parseFloat(right)) return [];
        }
        else {
          var j = 0;
          while (j < ul.length) {
            uj = ul[j];
            if (c.charAt(mark) == "s" && uj.side != right) ul.splice(j,1);
            else if (c.charAt(mark) == "x" && (uj.x < left || uj.x > right)) ul.splice(j,1);
            else if (c.charAt(mark) == "y" && (uj.y < left || uj.y > right)) ul.splice(j,1);
            else if (c.charAt(mark) == "h" && (uj.health < left || uj.health > right)) ul.splice(j,1);
            else if (c.charAt(mark) == "l" && los(uj.nx,uj.ny,left,right) < 1) ul.splice(j,1);
            else j++;
          }
        }
      }
    }
    if (ul.length == 0) return [];
  }
  return ul;
}
function check_events() {
  var i = 0;
  while (i < eventlist.length) {
    var e = eventlist[i].slice();
    for (var r in registerlist) {
      var re = new RegExp('_'+ r + '_','g');
      for (var j = 0; j < e.length; j++) {
        e[j] = e[j].replace(re,registerlist[r]);
      }
    }
    for (var j = 0; j < e.length; j++) e[j] = e[j].replace(/_.*_/g,'0');
    if (e[0] == "unit") {
      unitlist.push(new Unit(e[1],parseFloat(e[2]),parseFloat(e[3])));
      eventlist.splice(i,1);
    }
    else if (e[0] == "xunit") { //Strict unit placement
      unitlist.push(new Unit(e[1],parseFloat(e[2]),parseFloat(e[3]),1));
      eventlist.splice(i,1);
    }
    else if (e[0] == "win") {
      forcewin = 1;
      break;
    }
    else if (e[0] == "lose") {
      forcewin = -1;
      break;
    }
    else if (e[0] in {"when":1,"whenever":1} && time > 0) {
      var conds = e.slice(1,e.indexOf("do"));
      var u = check_conds(conds);
      if (conds.indexOf("none") < 0 ? u.length > 0 : u.length == 0) {
        eventlist.splice(i+1,0,e.slice(e.indexOf("do") + 1));
        if (e[0] == "when") eventlist.splice(i,1);
        else i += 1;
      }
      else i += 1;
    }
    else if (e[0] in {"set":1,"change":1}) { 
      var ind = e.indexOf("attribute");
      var conds = e.slice(1,ind);
      var u = check_conds(conds);
      var j = 0;
      var k = 0;
      while (j < unitlist.length && k < u.length) {
        if (unitlist[j].id < u[k].id) j += 1;
        else if (u[k].id < unitlist[j].id) k += 1;
        else {
          var s = (e[ind + 1] == "desc" || e[ind + 1] == "image") ? e[ind + 2] : parseFloat(e[ind + 2]);
          if (e[0] == "set") unitlist[j][e[ind + 1]] = s;
          else unitlist[j][e[ind + 1]] += s;
          j += 1;
        }
      }
      eventlist.splice(i,1);
    }
    else if (e[0] == "setr") {
      registerlist[e[1]] = e[2];
      eventlist.splice(i,1);
    }
    else if (e[0] == "changer") {
      registerlist[e[1]] += (e[ind + 1] == "desc" || e[ind + 1] == "image") ? e[2] : parseFloat(e[2]);
      eventlist.splice(i,1);
    }
    else if (e[0] == "setup") {
      setup = setup.concat([parseFloat(e[1]),parseFloat(e[2]),parseFloat(e[3]),parseFloat(e[4])])
      eventlist.splice(i,1);
    }
    else i += 1;
  }
}
//Generates base opportunity and threat map - the base opportunity map represents cells from which a unit of a particular side can attack, the value being the minimum range needed to take advantage of that particular opportunity, the base threat map represents cells from which a unit can be attacked, the value representing the total damage caused by currently non-occupied units (no point in worrying about units already attacking someone, since if they do turn to you that's just taking attention away from one of your team members)
function generate_side_specific_maps (side) { 
  var omap = Field(FIELDW,FIELDH,9999);
  var tmap = Field(FIELDW,FIELDH,0);
  for (var i = 0; i < unitlist.length; i++) {
    if (unitlist[i].side != side) {
      for (var x = 0; x < FIELDW; x++) {
        for (var y = 0; y < FIELDH; y++) {
          var d = unitlist[i].losmap[x][y];
          if (d < omap[x][y] || d < unitlist[i].range) { //Redundant check but doing faster checks first is good for optimization
            if (d < omap[x][y]) omap[x][y] = d;
            if (unitlist[i].in_combat == 0) {
              if (d < unitlist[i].range) tmap[x][y] += unitlist[i].damage;
            }
          }
        }
      }
    }
  }
  return [omap,tmap];
}
function generate_point_dmap (side,x,y) {
  if (x < 0) x = 0;
  if (x >= FIELDW) x = FIELDW - 1;
  if (y < 0) y = 0;
  if (y >= FIELDH) y = FIELDH - 1;
  var dmap = Field(FIELDW,FIELDH,99999);
  if (point_dmap_cache[x][y] != 0) {
    for (var i = 0; i < FIELDW; i++) {
      for (var j = 0; j < FIELDH; j++) {
        dmap[i][j] = point_dmap_cache[x][y][i][j];
      }
    }
  }
  else {
    dmap[x][y] = 0;
    dmap = generate_dmap(dmap);
    point_dmap_cache[x][y] = Field(FIELDW,FIELDH);
    for (var i = 0; i < FIELDW; i++) {
      for (var j = 0; j < FIELDH; j++) {
        point_dmap_cache[x][y][i][j] = dmap[i][j];
      }
    }
  }
  return dmap;
}
//Takes a map of destination coordinates and outputs a map of distances to the nearest destination coordinate; at least this is the way it works if all destination coords are represented by 0 - if they are not, then distances to that coordinate are increased or penalized - eg. a cell 15 away from a start of -5 would see a score of 10, even if the cell is 11-14 away from something with a start of 0.
function generate_dmap (source) {
  var dmap = Field(FIELDW,FIELDH,99999);
  points = [];
  for (var x = 0; x < FIELDW; x++) {
    for (var y = 0; y < FIELDH; y++) {
      if (terrain[x][y] > 0 && source[x][y] < 9999) points.push([x,y,source[x][y],0]);
    }
  }
  var count = 0;
  var movements = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  while (count < points.length) {
    var curx = points[count][0];
    var cury = points[count][1];
    //The algorithm fills in a map incrementally (numbers in all figures 2x):
    //                                     6 5 4 5 6
    //                   3 2 3             5 3 2 3 5
    //    0      -->     2 0 2     -->     4 2 0 2 4
    //                   3 2 3             5 3 2 3 5
    //                                     6 5 4 5 6
    //When a new point is introduced, the direction that point came from is tracked so that we don't try to fill in the points behind it that were obviously already filled in - this has been experimentally shown to make the algorithm 2-5x faster.
    if (dmap[curx][cury] > points[count][2]) {
      dmap[curx][cury] = points[count][2];
      var curdir = points[count][3];
      var spread = 1;
      if (wall_proximity_map[curx][cury] == 1) spread = 1 + curdir % 2;
      else spread = curdir % 2;
      //In an open space (wall_proximity_map[x][y] >= 2), the expansion is that of a square (see fig 1) - a frontier cell is either a corner, in which case an expansion requires one point to go into 3, ie. spread = 1, or an edge, where the cell can just keep going along its direction. In closed space, weird stuff happens like required 90' turns (see fig 2), so we need to increase the spread by 1.
      //
      //Figure 1
      //
      // ^ ^ ^  7
      // | | | /
      // 4 5 6 ->   <- corner case (direction coming from is diagonal, 3-split required)
      // 2 3 5 ->
      // 0 2 4 ->   <- edge case (direction is orthogonal, 1-split required)
      // 2 3 5 ->
      //Figure 2
      //
      // 7  6  7  8  10
      // 5  4  5  7  9
      // 3  2  X     10  <- 2 cells never get filled in because the algorithm can only turn 45' at a time
      // 2  0  X     12    
      // 3  2  X  15 14
      if (source[curx][cury] < 9999) spread = 4; //Accomodate the initial points with an omindirectional spread
      for (var dir = curdir + 8 - spread; dir <= curdir + 8 + spread; dir++) {
        d = dir % 8;
        var newx = curx + movements[d][0];
        var newy = cury + movements[d][1];
        if (newx >= 0 && newx < FIELDW && newy >= 0 && newy < FIELDH) {
          if (terrain[newx][newy] > 0) points.push([newx,newy,dmap[curx][cury] + 1 + 0.5 * (d % 2),d]);
        }
      }
    }
    count += 1;
  }
  return dmap;
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
  generate_occupation_map();
  var a = new Field(FIELDW,FIELDH);
  for (var i = 0; i < FIELDW; i++) {
    for (var j = 0; i < FIELDW; i++) {
      a[i][j] = occupied[i][j] == 0 ? 1 : 0;
    }
  }
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
  menu = new Menu(canvas,'Paused','Click or press enter to select');
  context = canvas.getContext('2d');
  time = start_time;
  realtime = 0;
  forcewin = 0;
  //This js file is not read directly, first the python script inserts the terrain, unitlist and other important stuff
  var level = unpack_level();
  terrain = level.terrain;
  draw_terrain();
  wall_proximity_map = new Field(FIELDW,FIELDH,0);
  var m = new Field(FIELDW,FIELDH,0);
  for (var x = 0; x < FIELDW; x++) {
    for (var y = 0; y < FIELDH; y++) {
      if (terrain[x][y] > 0) wall_proximity_map[x][y] = 99999;
      m[x][y] = terrain[x][y];
      terrain[x][y] = 1;
    }
  }
  //Shuffle around terrain and m for the sake of the generate_dmap function; it needs an open field to function
  wall_proximity_map = generate_dmap(wall_proximity_map); 
  terrain = m;
  classlist = level.classes;
  for (t in classlist) {
    classpics[t] = new Array(ROTATES);
    classpics[t][0] = new Image();
    if (classlist[t].image) classpics[t][0].src = (classlist[t].image.indexOf('/') == -1 ? "../../images/" : "") + classlist[t].image;
    else classpics[t][0].src = "../../images/Soldier.png";
  }
  setup = [];
  unitlist = [];
  eventlist = level.events;
  registerlist = {};
  check_events();
  story = level.story;
  story_lines = [];
  if (story.length == 0) time = 0;
  else { //Wraps up the story into lines so that it gets displayed nicely
    var place = 0;
    var newplace = 0;
    var width = 0;
    var newline = 0;
    context.font = "normal 20px sans-serif";
    while (place < story.length) {
      newplace = story.indexOf(" ",place + 1);
      if (newplace >= 0) width = context.measureText(story.substring(newline,newplace)).width;
      if (width > 400 || newplace == -1) {
        //If wrapping around a space is TOO inconvenient, don't bother
        var l = context.measureText(story.substring(newline,place)).width;
        var spacewidth = context.measureText(' ').width;
        if (l < 320) { 
          while (place < story.length && context.measureText(story.substring(newline,place)).width < 400) place += 1;
          //If the word at the end is too sesquipe-
          //dalian, break it up with a - like this
          if (place < story.length) story = story.substring(0,place - 1) + "-" + story.substring(place - 1);
        }
        else if (l < 395 - spacewidth) { //Manual justify
          var rep = newline;
          for (var i = 0; i < Math.floor((395 - l) / spacewidth); i++) {
            rep = story.indexOf(" ",rep + 2);
            if (rep < place && rep != -1) {
              story = story.substring(0,rep) + " " + story.substring(rep);
              place += 1;
            }
          }
        }
        story_lines.push(story.substring(newline,place));
        newline = place;
        if (story.charAt(newline) == " ") {
          newline++;
          place++;
        }
      }
      else place = newplace;
    }
  }
  gamestate = PAUSED;
  var d = new Date();
  last_update = d.getTime();
  friendly_losses = 0;
  enemy_losses = 0;
  friendly_count = 0;
  enemy_count = 0;
  for (var i = 0; i < unitlist.length; i++) {
    if (unitlist[i].side == 1) friendly_count += 1;
    else enemy_count += 1;
  }
  //Hide uninteresting html elements
  var forms = document.getElementsByTagName('form');
  for (var i = 0; i < forms.length; i++) forms[i].style.display = 'none';
  // Initialize menus
  pause_menu = new Menu(canvas,'Paused','Click or press enter to select');
  pause_menu.add_element("See high scores for this level", function() {gamestate = HIGHSCORE});
  pause_menu.add_element("Overview of game controls", function() {gamestate = CONTROLS});
  pause_menu.add_element("Resume", function() {gamestate = PLAYING});
  pause_menu.add_element("Restart this level",function() { leave(-1,"play",campaign + " " + counter)});
  pause_menu.add_element("Main menu",function() { leave(-1,"startscreen",campaign + " " + counter)});
  if (edit_status == 'CAN') {
    pause_menu.add_element("Edit this level",function() { leave(-2,"edit",campaign + " " + counter + " edit")});
    pause_menu.add_element("Add new level",function() { leave(-2,"edit",campaign + " " + (counter+1) + " add")});
    pause_menu.add_element("Delete this level",function() { gamestate = AREYOUSURE});
    var func = function() { document.getElementById("startscreen").style.display = "inline" };
    pause_menu.add_element("Copy all campaign data",func);
  }

  highscore_menu = new Menu(canvas,'High scores','Click or press enter to return');
  highscore_menu.add_element(new MenuElement("Lowest friendly losses: " + minloss.join(' ')));
  highscore_menu.add_element(new MenuElement("Highest kill/death ratio: " + maxratio.join(' ')));
  highscore_menu.add_element(new MenuElement("Shortest game time: " + mintime.join(' ')));
  highscore_menu.add_element(new MenuElement("Shortest real time: " + minrt.join(' ')));

  controls_menu = new Menu(canvas,'Controls','Click or press enter to return');
  controls_menu.add_element(new MenuElement("Right click or shift key to select units"));
  controls_menu.add_element(new MenuElement("Left click or enter key to move or send units"));
  controls_menu.add_element(new MenuElement("Middle click or F to move/send in formation"));
  controls_menu.add_element(new MenuElement("1 to set selected units to normal AI mode"));
  controls_menu.add_element(new MenuElement("2 to set to defensive mode, 3 for pacifist mode"));
  controls_menu.add_element(new MenuElement("4 for full computer control mode"));

  areyousure_menu = new Menu(canvas,"Are you sure?");
  areyousure_menu.add_element("No",function() {gamestate = PAUSED});
  areyousure_menu.add_element("Yes",function() {leave(-2,"play",campaign + " " + counter + " delete")});

  setInterval(update, 5);
}
function leave(win,form,info) {
  //if (form == 'edit') document.getElementsByName('message')[0].value = info;
  //else if (form == 'play') {
  //  document.getElementsByName('score')[0].value = [win,friendly_losses,enemy_losses,time,realtime].join(' ');
  //  document.getElementsByName('info')[0].value = info;
  //}
  //else if (form == 'startscreen') document.getElementsByName('campaign')[0].value = "";
  //document.forms[form].submit();
  if (form == 'next') window.location.href = next_location;
  else if (form == 'repeat') window.location.href = current_location;
}
function keydown(e) {
  if (!e) e = window.event;
  if (gamestate == WIN) { //Win
    leave(1,'next',campaign + " " + (counter+1));
  }
  if (e.keyCode == 16 && shiftdown == 0) { //16 = shift
    shiftdown = 1;
    clickx = mousex;
    clicky = mousey;
  }
  if (e.keyCode == 13) { //13 = enter
     if (gamestate == PLAYING || time == 0) send_targets();
     else if (gamestate == HIGHSCORE || gamestate == CONTROLS) gamestate = PAUSED;
     else menu.select();
  }
  if (e.keyCode == 70 && (gamestate == PLAYING || time == 0)) send_targets(1); //Hit F to send targets in formation
  if (e.keyCode in {49:1,50:2,51:3,52:4}) { //1,2,3,4 set AI mode
    for (var j = 0; j < unitlist.length; j++) {
      if (unitlist[j].selected == 1 && unitlist[j].aitype > 0) unitlist[j].aitype = e.keyCode - 48;
    }
  }
  if ((e.keyCode == 88 || e.keyCode == 90) && (gamestate == PLAYING || time == 0)) { //x,z keys set target level
    for (var j = 0; j < unitlist.length; j++) {
      if (unitlist[j].selected) {
        if (e.keyCode == 88 && unitlist[j].targeted < 3) unitlist[j].targeted += 1;
        else if (e.keyCode == 90 && unitlist[j].targeted > 0) unitlist[j].targeted -= 1;
      }
    }
  }
  if (e.keyCode == 32 || e.keyCode == 80) gamestate = (gamestate == PAUSED) ? PLAYING : PAUSED;
  if (e.keyCode == 77) { //M for menu
    gamestate = PAUSED;
    if (time <= 0) time = 1;
  }
  //Speed up and slow down the game
  if (e.keyCode == 187 || e.keyCode == 87) msperframe = Math.min(last_frame_length * 1.25 + 5,83);
  if (e.keyCode == 189 || e.keyCode == 81) msperframe = Math.max(last_frame_length * 0.8 - 4,4);
  //Arrow keys control menu
  if (e.keyCode in {38:1,40:1}) {
    if (menu.pos < 0) menu.pos = 0;
    if (menu.pos >= menu.elements.length) menu.pos = menu.elements.length - 1;
    menu.pos += e.keyCode - 39;
    if (menu.pos < 0) menu.pos = 0;
    if (menu.pos >= menu.elements.length) menu.pos = menu.elements.length - 1;
  }
}
function keyup(e) {
  if (!e) e = window.event;
  if (e.keyCode == 16) shiftdown = 0;
}
function getmousexy(e) {
  MANUALOFFSET_X = -9;
  MANUALOFFSET_Y = -10;
  mousex = e.clientX - canvas.offsetLeft + MANUALOFFSET_X;
  mousey = e.clientY - canvas.offsetTop + MANUALOFFSET_Y;
  menu.pos = menu.mousey_to_pos(mousey);
}
function generate_occupation_map() {
  var o = new Field(FIELDW,FIELDH,-1);
  for (var i = 0; i < FIELDW; i++) {
    for (var j = 0; j < FIELDH; j++) {
      o[i][j] = terrain[i][j] > 0 ? 0 : -1;
    }
  }
  for (var i = 0; i < unitlist.length; i++) {
    o[unitlist[i].nx][unitlist[i].ny] = unitlist[i].id;
  }
  occupied = o;
}
//Creates a rotated image for a particular unit class at a particular angle and caches it
function create_classpic(uclass,index) {
  var tempcanvas = document.createElement('canvas');
  var sz = Math.max(classpics[uclass][0].width,classpics[uclass][0].height);
  tempcanvas.width = sz;
  tempcanvas.height = sz;
  var tempcontext = tempcanvas.getContext('2d');
  var hsize = classpics[uclass][0].width;
  var vsize = classpics[uclass][0].height;
  tempcontext.translate(hsize * 0.5,vsize * 0.5);
  tempcontext.rotate(index * Math.PI * 2 / ROTATES);
  tempcontext.drawImage(classpics[uclass][0],-hsize * 0.5,-vsize * 0.5,hsize,vsize);
  tempcontext.rotate(0 - index * Math.PI * 2 / ROTATES);
  tempcontext.translate(hsize * -0.5,vsize * -0.5);
  var picurl = tempcanvas.toDataURL();
  classpics[uclass][index] = new Image();
  classpics[uclass][index].src = picurl;
}
function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
//Story mode
  if (time < 0) {
    context.font = "normal 20px sans-serif";
    context.fillStyle = "rgb(0,160,0)";
    for (var x = 0; x < canvas.width;x += grass.width) {
      for (var y = 0; y < canvas.width;y += grass.width) {
        context.drawImage(grass,x,y);
      }
    }
    context.fillStyle = "rgb(0,0,0)";
    var story_top = story_lines.length < 16 ? 100 : 260 - story_lines.length * 10;
    for (var i = 0; i < story_lines.length; i++) {
      context.fillText(story_lines[i],100,story_top + 20 * i);
    }
    return;
  }
//Normal mode
  //Background
  context.drawImage(background,0,0);
  //Draw units
  for (var i = 0; i < unitlist.length; i++) {
    var hsize = unitlist[i].pic.width;
    var vsize = unitlist[i].pic.height;
    var ux = unitlist[i].x * CELLSIZE;
    var uy = unitlist[i].y * CELLSIZE;
    var index = Math.floor(unitlist[i].ang * (ROTATES / 2) / Math.PI);
    if (classpics[unitlist[i].uclass][index] == undefined) create_classpic(unitlist[i].uclass,index);
    context.drawImage(classpics[unitlist[i].uclass][index],ux - hsize * 0.5,uy - vsize * 0.5);
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
    if (unitlist[i].health < 300) context.fillRect(ux - h,uy - 14 - v, h * 2,v);
    else {
      h = Math.floor(Math.log(unitlist[i].health) * 0.4343) * 5 + 5; //Number of digits * 5
      v = 14;
      context.fillText(Math.floor(unitlist[i].health),ux - h + 2,uy - 16,h * 2 - 5);
    }
    //Draw rectangle around healthbar if selected
    if (unitlist[i].selected == 1) {
      context.fillStyle = "rgb(0,0,0)";
      context.fillRect(ux - h - 1,uy - v - 15, h * 2 + 2,2);
      context.fillRect(ux - h - 1,uy - 15, h * 2 + 2,2);
      context.fillRect(ux - h - 1,uy - v - 13, 2, v - 2);
      context.fillRect(ux + h - 1,uy - v - 13, 2, v - 2);
    }
    //Draw Xs if targeted
    for (var j = 0; j < unitlist[i].targeted; j++) {
      context.beginPath();
      var p = j * 8 - (unitlist[i].targeted - 1) * 4;
      context.moveTo(ux + p - 3,uy - 6)
      context.lineTo(ux + p + 3,uy - 12)
      context.moveTo(ux + p - 3,uy - 12)
      context.lineTo(ux + p + 3,uy - 6)
      context.strokeStyle = "rgb(255,0,0)";
      context.stroke();
    }
  }
  context.fillStyle = "rgb(0,0,0)";
  context.font = "bold 15px sans-serif";
  if (gamestate == PLAYING) {
    menu_shown = 0;
    var bottomstring = "Milliseconds/frame: " + last_frame_length;
    bottomstring += "    Time: " + time + " (" + (realtime * 0.001 + "").substring(0,5) + " real time)"
    if (friendly_losses > 0) bottomstring += "    Friendly: " + friendly_count + " (-" + friendly_losses + ")";
    else bottomstring += "    Friendly: " + friendly_count;
    if (enemy_losses > 0) bottomstring += "    Enemy: " + enemy_count + " (-" + enemy_losses + ")";
    else bottomstring += "    Enemy: " + enemy_count;
    context.fillText(bottomstring,10,463,580);
  }
  else {
    if (time > 0) {
      menu_shown = 1;
      if (gamestate == PAUSED) menu = pause_menu;
      else if (gamestate == CONTROLS) menu = controls_menu;
      else if (gamestate == HIGHSCORE) menu = highscore_menu;
      else if (gamestate == WIN) menu = win_menu;
      else if (gamestate == AREYOUSURE) menu = areyousure_menu;
      menu.draw();
    }
    else context.fillText("Initial deployment; press SPACE to start, M for menu",10,463);
  }
  //context.fillText("Debug values: " + debug_vars[0] + " " + debug_vars[1] + " " + debug_vars[2] + " " + debug_vars[3] + " " + debug_vars[4],10,480);
  //Moving the context around; why can't there be a feature to just rotate the damn image; looks like only Microsoft was smart enough to implement that in IE6 and 7; as a Linux user this makes me cry :(...
  //Debug code if anyone needs it
  /*context.font = "bold 8px sans-serif";
  context.fillStyle = "rgb(0,0,0)";
  for (var i = 0; i < FIELDW; i++) {
    for (var j = 0; j < FIELDH; j++) {
      context.fillText(Math.floor(fdm[i][j] * 2),i * CELLSIZE,j * CELLSIZE + 0.5 * CELLSIZE);
    }
  }*/
  //Draw archer attacks
  context.beginPath();
  for (var i = 0; i < attacklist.length; i++) {
    context.moveTo(attacklist[i][0] * CELLSIZE,attacklist[i][1] * CELLSIZE);
    context.lineTo(attacklist[i][2] * CELLSIZE,attacklist[i][3] * CELLSIZE);
  }
  context.strokeStyle = "rgb(0,0,0)";
  context.stroke();
  //Setup rectangle if necessary
  if (time == 0) {
    context.fillStyle = "rgba(255,255,0,0.5)";
    for (var i = 0; i < setup.length; i += 4) {
      context.fillRect(setup[i] * CELLSIZE,setup[i + 1] * CELLSIZE,(setup[i + 2] - setup[i]) * CELLSIZE,(setup[i + 3] - setup[i + 1]) * CELLSIZE);
    }
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
function onclick(e) {
  clickx = mousex;
  clicky = mousey;
  mousedown = e.button;
  if (mousedown < 2 && (gamestate == PLAYING || time == 0)) send_targets(mousedown);
  else if (gamestate == CONTROLS || gamestate == HIGHSCORE) gamestate = PAUSED;
  else if ((gamestate == PAUSED || gamestate == AREYOUSURE) && clickx > 0 && clickx < canvas.width) menu.select();
}
function send_targets(in_formation) {
  var mx = Math.floor(mousex / CELLSIZE);
  var my = Math.floor(mousey / CELLSIZE);
  if (!in_formation) var in_formation = 0;
  if (in_formation == 1) {
    var sumx = 0;
    var sumy = 0;
    var count = 0;
    for (var i = 0; i < unitlist.length; i++) {
      if (unitlist[i].selected == 1 && unitlist[i].aitype > 0) {
        sumx += unitlist[i].x;
        sumy += unitlist[i].y;
        count += 1;
      }
    }
    var dx = mx - Math.floor(sumx / count);  
    var dy = my - Math.floor(sumy / count);  
  }
  //Avoid duplicating effort
  else var dmap = generate_point_dmap(1,mx,my);
  for (var i = 0; i < unitlist.length; i++) {
    if (unitlist[i].selected == 1 && unitlist[i].aitype > 0) {
      if (in_formation == 1) {
        dfx = Math.floor(unitlist[i].x + dx);
        dfy = Math.floor(unitlist[i].y + dy);
      }
      else {
        dfx = mx;
        dfy = my;
      }
      if (unitlist[i].aitype == 4) unitlist[i].aitype = 1;
      if (in_formation == 0 && unitlist[i].aitype == 1 && unitlist[i].side == 1) unitlist[i].dmap = dmap;
      else unitlist[i].dmap = generate_point_dmap(unitlist[i].side,dfx,dfy);
      //Setup rectangle case (the setup rectangle is active and destination is within it)
      if (time == 0) {
        var inside_rect = 0;
        for (var j = 0; j < setup.length; j += 4) {
          if ((dfx + 0.5 - setup[j]) * (dfx + 0.5 - setup[j + 2]) < 0 && (dfy + 0.5 - setup[j + 1]) * (dfy + 0.5 - setup[j + 3]) < 0 && occupied[dfx][dfy] == 0) inside_rect = 1;
        }
        if (inside_rect) {
          unitlist[i].setpos(dfx + 0.5,dfy + 0.5);
          unitlist[i].selected = 0;
          if (in_formation == 0) break;
        }
      }
    }
  }
}
function select_targets() {
  var count = 0;
  for (var i = 0; i < unitlist.length; i++) {
    if ((unitlist[i].x * CELLSIZE - clickx) * (unitlist[i].x * CELLSIZE - mousex) < 0 && (unitlist[i].y * CELLSIZE - clicky) * (unitlist[i].y * CELLSIZE - mousey) <= 0) {
      unitlist[i].selected = 1;
      count += 1;
    }
    else unitlist[i].selected = 0;
  }
  if (count == 0) {
    var closest = -1;
    var mindist = FIELDW + FIELDH;
    for (var i = 0; i < unitlist.length; i++) {
      var d = dist(unitlist[i].x * CELLSIZE,unitlist[i].y * CELLSIZE,mousex,mousey);
      if (d < mindist) {
        mindist = d;
        closest = i;
      }
    }
    if (closest >= 0) unitlist[closest].selected = 1;
  }
}
function release(e) {
  mousedown = 0;
}
function update()
{
  var t = new Date().getTime();
  if (gamestate == PLAYING && t > last_update + msperframe) {
    last_frame_length = t - last_update;
    realtime += last_frame_length;
    last_update = t;
    //Event management
    check_events();
    //Did we win or lose?
    friendly_count = 0;
    enemy_count = 0;
    for (var i = 0; i < unitlist.length; i++) {
      if (unitlist[i].side == 1) friendly_count += 1;
      else enemy_count += 1;
    }
    if ((friendly_count == 0 && forcewin < 1) || forcewin == -1) {
      gamestate = PAUSED;
      result = [0,friendly_losses,enemy_losses,time,realtime];
      leave(0,'repeat',campaign + " " + counter);
    }
    else if (enemy_count == 0 || forcewin == 1) {
      result = [1,friendly_losses,enemy_losses,time,realtime];
      var tt = "Success!";
      if (friendly_losses < minloss[0] || your_ratio > maxratio[0] || time < mintime[0] || realtime < minrt[0] * 1000)
        tt = "High score!";
      your_ratio = enemy_losses / friendly_losses;
      win_menu = new Menu(canvas,tt,"Press any key to continue");
      win_menu.add_element(new MenuElement("Friendly losses: " + friendly_losses));
      win_menu.add_element(new MenuElement("Enemy losses: " + enemy_losses + " (" + your_ratio.toFixed(3) + " ratio)"));
      win_menu.add_element(new MenuElement("Game time: " + time));
      win_menu.add_element(new MenuElement("Real time: " + realtime * 0.001));
      gamestate = WIN;
      if (time == 0) leave(1,'next',campaign + " " + (counter+1));
    }
    //Generate unit ID lookup table
    id_lookup = [];
    for (var i = 0; i < unitlist.length; i++) id_lookup[unitlist[i].id] = i;
    //Generate the map of what cells are inaccessible
    generate_occupation_map();
    //Generate the list of sides
    sidelist = [];
    for (var i = 0; i < unitlist.length; i++) {
      var j = 0;
      for (j = 0; j < sidelist.length; j++) {
        if (unitlist[i].side == sidelist[j]) break;
      }
      if (j == sidelist.length) sidelist.push(unitlist[i].side);
    }
    //Generate starting threat and opportunity map for each side
    for (var i = 0; i < sidelist.length; i++) {
      var o = generate_side_specific_maps(sidelist[i]);
      opportunity_map[sidelist[i]] = o[0];
      threat_map[sidelist[i]] = o[1];
    }
    //Loop to set up distance maps, opportunity maps, threat maps (for AI purposes) for each unit; must be done separately
    //from AI function since sometimes the maps are calculated once for multiple units
    for (var i = 0; i < unitlist.length; i++) {
      if ((unitlist[i].aitype == 0 || unitlist[i].aitype == 4) && unitlist[i].speed > 0) {
        var dmap_cache_found = 0;
        for (var j = i - 1; j >= 0; j--) {
          if (unitlist[i].uclass == unitlist[j].uclass && unitlist[i].aitype == unitlist[j].aitype) {
            unitlist[i].dmap = unitlist[j].dmap;
            dmap_cache_found = 1;
            break;
          }
        }
        if (dmap_cache_found == 0) {
          //Create unit-specific opportunity map (since different units have different ranges) and base threat maps from the negative log2 of the magnitude of the threat (a threat that attacks for 64 gets a score of -6, one that attacks for 8 gets a score of -3, etc. Thus, there is an incentive to keep even further away from greater threats.
          var om = Field(FIELDW,FIELDH,99999);
          var tm = Field(FIELDW,FIELDH,99999);
          for (var x = 0; x < FIELDW; x++) {
            for (var y = 0; y < FIELDH; y++) {
              if (opportunity_map[unitlist[i].side][x][y] < unitlist[i].range) om[x][y] = 0;
              if (threat_map[unitlist[i].side][x][y] > 0) tm[x][y] = -0.693 * Math.log(threat_map[unitlist[i].side][x][y]);
            }
          }
          //om and tm are at first the maps of opportunities and targets. The generate_dmap function converts them into maps of distances to targets
          var dm = generate_dmap(om);
          var tm = generate_dmap(tm);
          for (var x = 0; x < FIELDW; x++) {
            for (var y = 0; y < FIELDH; y++) {
              if (tm[x][y] < 9999) dm[x][y] -= tm[x][y] * 0.33;
            }
          }
          unitlist[i].dmap = dm;
        }
      }
    }
    //AI/movement loop
    for (var i = 0; i < unitlist.length; i++) {
      if (unitlist[i].speed > 0) unitlist[i].ai();
    }
    //Attack loop
    attacklist = [];
    for (var i = 0; i < unitlist.length; i++) {
      var u = unitlist[i];
      if (u.aitype != 3 && u.damage > 0) u.attack_in -= 1;
      if (u.attack_in < 0 && u.aitype != 3 && u.damage > 0) { //3 = pacifist flee mode
        var v = u.getvictim();
        if (v[0] >= 0) {
          u.attack_in = 10;
          for (j in v[1]) unitlist[j].health -= v[1][j];
          u.ang = getang(u.nx,u.ny,unitlist[v[0]].nx,unitlist[v[0]].ny);
          if (dist(u.x,u.y,unitlist[v[0]].x,unitlist[v[0]].y) > 3.33) 
            attacklist.push([u.x,u.y,unitlist[v[0]].x,unitlist[v[0]].y]);
          u.in_combat = 1;
        }
        else u.in_combat = 0;
      }
    }
    //The unit popping loop (best kept separate)
    var i = 0;
    while (i < unitlist.length) {
      if (unitlist[i].health <= 0) {
        if (unitlist[i].side == 1) friendly_losses += 1;
        else enemy_losses += 1;
        unitlist.splice(i,1);
      }
      else i += 1;
    }
    time += 1;
    //Time -1 is startscreen, after that is time 0, the pre-game pause
    if (time == 0) gamestate = PAUSED;
    draw();
  }
  if (gamestate != PLAYING) {
    last_update = new Date().getTime();
    //Get to work creating rotated image drawings
    var done = 0;
    while (!done && rotates_caching_at < ROTATES && time >= 0) {
      for (uclass in classlist) {
        if (classpics[uclass][rotates_caching_at] == undefined) {
          create_classpic(uclass,rotates_caching_at);
          done = 1;
          break;
        } 
      }
      if (!done) rotates_caching_at++;
    }
    draw();
  }
}
