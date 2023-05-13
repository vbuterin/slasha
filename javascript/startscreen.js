// target frames per second
const FPS = 25;
var canvas = null;
var context = null;
window.onload = init;
window.onkeydown = keydown;
//Mouse handling
window.onmousemove = mousemove;
window.onmousedown = mousedown;
var selected = 0;
var hselected = 0;
var grass = new Image(); 
grass.src = 'images/grass.jpg';
var rock = new Image(); 
rock.src = 'images/rock.jpg';
const LEVELS_SHOWN = 11;
function init()
{
  canvas = document.getElementById('canvas');
  context = canvas.getContext('2d');
  setInterval(draw, 1000 / FPS);
  //OPTIONS HERE
  for (var i = 0; i < options.length; i++) {
    options[i][3] = Math.max(Math.min(options[i][2] - (LEVELS_SHOWN-1),options[i][1] - Math.floor((LEVELS_SHOWN-1) / 2)),1);
  }
}
function keydown(e) {
  if (!e) {
    e = window.event;
  }
  if (e.keyCode == 38 && selected > 0) {
    selected -= 1;
    if (hselected > options[selected][1] - options[selected][3]) hselected = options[selected][1] - options[selected][3];
    if (hselected < 0) hselected = 0;
  }
  if (e.keyCode == 40 && selected < options.length - 1) {
    selected += 1;
    if (hselected > options[selected][1] - options[selected][3]) hselected = options[selected][1] - options[selected][3];
  }
  if (e.keyCode == 37) {
    if (hselected > 0) hselected -= 1;
    else if (hselected <= 0 && options[selected][3] > 1) {
      options[selected][3] -= 1;
      if (options[selected][3] == 1) hselected = 0;
    }
  }
  if (e.keyCode == 39) {
    if (hselected + options[selected][3] < options[selected][1]) {
      if (hselected < (LEVELS_SHOWN - 1)) hselected += 1;
      else {
        options[selected][3] += 1;
        if (options[selected][3] + hselected + LEVELS_SHOWN - 1 == options[selected][1]) hselected -= 1;
      }
    }
  }
  if (e.keyCode == 13 && document.activeElement != document.getElementsByName('campaign')[0]) click();
  //e.keyCode == 37 for a  left arrow, 38 = up arrow, 39 = right arrow, 40 = down arrow
}
function mousedown(e) {
  if (!e) {
    e = window.event;
  }
  if (e.clientY < 500) click();
}
function click() {
  if (hselected == -1 && options[selected][2] > 0) {
    options[selected][3] -= 1;
    if (options[selected][3] == 1) hselected = 0;
  }
  else if (hselected == LEVELS_SHOWN) {
    options[selected][3] += 1;
    if (options[selected][3] + LEVELS_SHOWN - 1 == options[selected][1]) hselected = LEVELS_SHOWN - 1;
  }
  else submit();
}
function submit() {
  if (options[selected][0] == "Create new") {
    var campaign = prompt('Enter campaign name');
    document.getElementsByName('message')[0].value = campaign + " 1 add";
    document.forms['edit'].submit();
  }
  else if (options[selected][0] == "Paste campaign file") {
    document.forms['startscreen'].submit();
  }
  else if (options[selected][0] == "View level development guide") {
    document.getElementsByName('campaign')[0].value = "devguide";
    document.forms['startscreen'].submit();
  }
  else {
    document.getElementsByName('info')[0].value = options[selected][0] + " " + (hselected + options[selected][3]);
    document.forms['play'].submit();
  }
}
function mousemove(e) {
  selected = Math.floor((e.clientY - canvas.offsetTop - 100) / 20.0);
  if (selected < 0) selected = 0;
  if (selected > options.length - 1) selected = options.length - 1;
  hselected = Math.floor((e.clientX - canvas.offsetTop - 225) / 25.0);
  if (hselected < 0) {
    if (options[selected][3] == 1) hselected = 0;
    else hselected = -1;
  }
  if (hselected + options[selected][3] > options[selected][1]) hselected = options[selected][1] - options[selected][3];
  if (hselected > (LEVELS_SHOWN - 1)) {
    if (options[selected][3] + LEVELS_SHOWN - 1 < options[selected][1]) hselected = LEVELS_SHOWN;
    else hselected = LEVELS_SHOWN - 1;
  }
}
function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (var x = 0; x < canvas.width;x += grass.width) {
    for (var y = 0; y < canvas.height;y += grass.height) {
      context.drawImage(grass,x,y);
    }
  }
  for (var x = 0; x < canvas.width; x += rock.width)
    context.drawImage(rock,0,0,rock.width,30,x,0,rock.width,30);
  context.fillStyle="rgba(0,255,0,0.5)";
  context.fillRect(0,100 + selected * 20,canvas.width,20);
  if (options[selected][2] > 0) context.fillRect(225 + hselected * 25,100 + selected * 20,25,20);
  context.fillStyle="rgb(0,0,0)";
  context.font = "bold 25px sans-serif";
  context.textAlign = "left";
  context.fillText("Slasha 31",8,24);
  for (var i = 0; i < options.length; i++) {
    context.fillStyle = "rgb(0,0,0)";
    context.font = "bold 15px sans-serif";
    context.textAlign = "left";
    context.fillText(options[i][0],100,115 + i * 20);
    context.textAlign = "center";
    if (options[i][3] > 1) context.fillText('<',212,115 + i * 20);
    for (var j = options[i][3]; j <= options[i][2] && j < options[i][3] + LEVELS_SHOWN; j++) {
      context.fillText(j,237 + (j - options[i][3]) * 25,115 + i * 20); 
      if (options[i][1] == j) context.fillStyle = "rgb(192,192,192)";
    }
    if (options[i][3] + LEVELS_SHOWN - 1 < options[i][2]) context.fillText('>',237 + LEVELS_SHOWN * 25,115 + i * 20);
  }
  //Hide uninteresting html elements
  document.getElementById('play').style.display = 'none';
  document.getElementById('edit').style.display = 'none';
  document.getElementById('ctrlreminder').style.display = 'none';
  if (options[selected][0] != "Paste campaign file") document.getElementById('startscreen').style.display = 'none';
  else document.getElementById('startscreen').style.display = 'inline';
}
