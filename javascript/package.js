function textify() {
  var data = "##story##\n";
  data += story;
  data += "\n##classes##\n";
  for (var i = 0; i < classlist.length; i++) data += classlist[i][0] + " " + JSON.stringify(classlist[i][1]) + '\n';
  data += "##events##\n";
  for (var i = 0; i < eventlist.length; i++) {
    if (eventlist[i][0] != "none") data += eventlist[i].join(' ') + '\n';
  }
  data += "\n##terrain##\n";
  data += JSON.stringify(terrain);
  document.getElementsByName('data')[0].value = data;
}
function replace_text_block(heading, str) {
  var d = document.getElementsByName('data')[0]
  var start = d.value.indexOf("##" + heading + "##");
  var end = d.value.indexOf("##",start + 5 + heading.length);
  if (end < 0) end = d.value.length;
  d.value = d.value.replace(d.value.substr(start,end-start),"##" + heading + "##\n" + str);
}
function textify_classes() {
  var cstring = "";
  for (var i = 0; i < classlist.length; i++) cstring += classlist[i][0] + " " + JSON.stringify(classlist[i][1]) + "\n";
  replace_text_block("classes",cstring);
}
function textify_events() {
  var estring = "";
  for (var i = 0; i < eventlist.length; i++) {
    if (eventlist[i][0] != "none") estring += eventlist[i].join(' ') + '\n';
  }
  replace_text_block("events",estring);
}
function textify_terrain() {
  replace_text_block("terrain",JSON.stringify(terrain));
}
function unpack_level() {
  var d = document.getElementsByName('data')[0];
  var lines = d.value.split('\n');
  var at = "";
  var story = "";
  var classes_text = [];
  var events_text = [];
  var terrain_text = "";
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].substring(0,2) == "##" && lines[i].substring(lines[i].length - 2) == "##") at = lines[i];
    else if (at == "##story##" && lines[i] != "") story += lines[i];
    else if (at == "##classes##" && lines[i] != "") classes_text.push(lines[i]);
    else if (at == "##events##" && lines[i] != "") events_text.push(lines[i]);
    else if (at == "##terrain##" && lines[i] != "") terrain_text = lines[i];
  }
  var terrain = JSON.parse(terrain_text);
  var classes = {};
  var events = [];
  for (var i = 0; i < classes_text.length; i++) {
    var c = classes_text[i];
    var name = c.substring(0,c.indexOf(' '));
    var atts = c.substring(c.indexOf('{')).replace(/'/g,'"');
    classes[name] = JSON.parse(atts);
  }
  for (var i = 0; i < events_text.length; i++) {
    events.push(events_text[i].split(' '));
  }
  return {'story':story,'classes':classes,'events':events,'terrain':terrain};
}
