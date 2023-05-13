function MenuElement (text, action) {
  this.text = text;
  this.action = action ? action : function() { };
}
function Menu (canvas, toptext, bottomtext) {
  this.toptext = toptext ? toptext : "";
  this.bottomtext = bottomtext ? bottomtext : "";
  this.elements = [];
  this.canvas = canvas;
  this.context = canvas.getContext('2d');
  this.cx = canvas.width / 2;
  this.cy = canvas.height / 2;
  this.pos = 0;
  this.add_element = function() {
    if (arguments.length == 1) this.elements.push(arguments[0]);
    else this.elements.push(new MenuElement(arguments[0],arguments[1]));
  }
  this.mousey_to_pos = function(mousey) {
    var menutop = this.cy - this.elements.length * 10 + (this.toptext != "") * 20 - (this.bottomtext != "") * 20;
    var p = Math.floor((mousey - menutop) / 20);
    if (p < -1) p = -1;
    if (p > menu.elements.length) p = menu.elements.length;
    return p;
  }
  this.select = function() {
    if (this.pos >= 0 && this.pos < this.elements.length) this.elements[this.pos].action();
  }
  this.draw = function(align) {
    context.textAlign = "center";
    context.textBaseline = "middle";
    var options = [];
    for (var i = 0; i < this.elements.length; i++) options.push(this.elements[i].text);
    if (this.toptext != "") options = [this.toptext,''].concat(options);
    if (this.bottomtext != "") options = options.concat(['',this.bottomtext]);
    var menu_height = options.length * 20 + 20;
    var menu_width = 40;
    for (var i = 0; i < options.length; i++) {
      var w = context.measureText(options[i]).width;
      if (w + 40 > menu_width) menu_width = w + 40;
    }
    context.fillStyle = "rgba(0,0,0,0.5)";
    context.fillRect(this.cx - menu_width * 0.5,this.cy - menu_height * 0.5,menu_width,menu_height);
    if (this.pos >= 0 && this.pos < this.elements.length) {
      var y = this.cy + 10 - menu_height * 0.5 + this.pos * 20 + (toptext == "" ? 0 : 40);
      context.fillRect(this.cx - menu_width * 0.5,y,menu_width,20);
    }
    context.fillStyle = "rgba(192,192,192,1)";
    var pos = this.cx;
    for (var i = 0; i < options.length; i++) {
      if (i == 2 && align && align == "left") {
        context.textAlign = "left";
        pos = this.cx + 20 - menu_width * 0.5;
      }
      if (i == 2 && align && align == "right") {
        context.textAlign = "right";
        pos = this.cx - 20 + menu_width * 0.5;
      }
      if (this.bottomtext != "" && i == options.length - 1) {
        context.textAlign = "center";
        pos = this.cx;
      }
      context.fillText(options[i],pos,this.cy + 20 - menu_height * 0.5 + i * 20);
    }
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
  }  
}
