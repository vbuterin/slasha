import os, datetime
from google.appengine.ext import db
from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.ext.webapp import template
# Our save data
class Savedata (db.Model):
  player = db.StringProperty()
  nick = db.StringProperty()
  campaign = db.StringProperty()
  counter = db.IntegerProperty()
class Result (db.Model):
  player = db.StringProperty()
  nick = db.StringProperty()
  campaign = db.StringProperty()
  counter = db.IntegerProperty()
  win = db.IntegerProperty()
  friendly_losses = db.IntegerProperty()
  enemy_losses = db.IntegerProperty()
  time = db.IntegerProperty()
  realtime = db.IntegerProperty()
  worldtime = db.DateTimeProperty(auto_now=True)
class Level (db.Model):
  text = db.TextProperty()
  counter = db.IntegerProperty()
  campaign = db.StringProperty()
  owner = db.StringProperty()
  nick = db.StringProperty()
  date = db.DateTimeProperty(auto_now=True)
class MainPage (webapp.RequestHandler):
  def get(self): self.post()
  def post(self):
    user = users.get_current_user()
    if user: self.redirect('/startscreen')
    else:
        openid_providers = ('Google.com/accounts/o8/id','Yahoo.com', 'MySpace.com', 'AOL.com', 'MyOpenID.com')
        self.response.out.write("""
        <style type="text/css">
	#container { position:absolute; top:50%; width:100%; height:10em; margin-top:-5em }
        </style>
        <center><div id="container">Welcome! Please sign in at an OpenID provider to continue:<br><br>""")
        for address in openid_providers:
            self.response.out.write('<a href="%s">%s</a><br>' % (
                users.create_login_url(self.request.uri,federated_identity=address.lower()), address.split('.')[0]))
        self.response.out.write('</div></center>')
class Devguide (webapp.RequestHandler):
  def get(self): self.post()
  def post(self): self.response.out.write(open('devguide.html').read())
class Example (webapp.RequestHandler):
  def get(self): self.post()
  def post(self): 
    self.response.headers['Content-Type'] = 'text/plain'
    self.response.out.write(open('tutorial.txt').read())
class Startscreen (webapp.RequestHandler):
  def get(self): self.post()
  def post(self):
    user = users.get_current_user()
    # Upload campaigns locally stored if they are not already uploaded
    if user:
      for d in os.listdir('data'):
        textcmp = open(os.path.join('data',d)).read()
        name = textcmp[textcmp.find(": ") + 2:textcmp.find("\n")]
        campaign_exists = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+name+"' AND ANCESTOR IS :1",db.Key.from_path('Level','level')).count()
        if campaign_exists == 0: load_campaign(textcmp,user)
    else: self.redirect(users.create_login_url(self.request.uri))
    # Upload campaign from textbox if desired
    textcmp = self.request.get("campaign")
    if "---------" in textcmp:
      name = textcmp[textcmp.find(": ") + 2:textcmp.find("\n")-1]
      campaign_exists = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+name+"' AND ANCESTOR IS :1",db.Key.from_path('Level','level')).count()
      if campaign_exists == 0: load_campaign(textcmp,user)
      else: self.response.out.write("<script>alert('Campaign already exists!')</script>")
    # Redirect to devguide if desired
    if textcmp == "devguide": self.redirect('/devguide')
    # Try to load savefile
    saves = []
    if user:
      campaigns = {}
      campaign_status = {}
      levels = db.GqlQuery("SELECT * FROM Level WHERE ANCESTOR IS :1",db.Key.from_path('Level','level'))
      for level in levels:
          if level.campaign not in campaigns.keys(): campaigns[level.campaign] = 0
          if campaigns[level.campaign] < level.counter: campaigns[level.campaign] = level.counter
      existing_saves = db.GqlQuery("SELECT * FROM Savedata WHERE player='"+user.user_id()+"' AND ANCESTOR IS :1",db.Key.from_path('Savedata','savedata'))
      for save in existing_saves:
          if save.campaign not in [x['campaign'] for x in saves] and save.campaign in campaigns:
            campaign_status[save.campaign] = save.counter
            saves.append({'player':save.player,'nick':save.nick,'campaign':save.campaign,'counter':save.counter,'levels':campaigns[save.campaign]})
      for c in campaigns.keys():
        if c not in campaign_status.keys(): saves.append({'player':user.user_id(),'nick':user.nickname(),'campaign':c,'counter':1,'levels':campaigns[c]})
    else: self.redirect(users.create_login_url(self.request.uri))
    # Set specific variables and initialize the level
    init_vars = "options = [];\n"
    for s in saves: init_vars += "options.push(['"+ s['campaign']+"',"+ str(s['counter'])+","+ str(s['levels'])+ "]);\n  ";
    init_vars += "options.push(['Create new',0,0]);\n  "
    init_vars += "options.push(['Paste campaign file',0,0]);"
    init_vars += "options.push(['View level development guide',0,0]);"
    self.response.out.write(open('template.html').read() % (init_vars,"javascript/startscreen.js","",""));
def create_level (text,campaign,counter,owner,nick):
    level = Level(parent=db.Key.from_path('Level','level'))
    level.text = text;
    level.campaign = campaign;
    level.counter = counter;
    level.owner = owner
    level.nick = nick
    return level
def package_campaign (campaign):
    s = "Name: " + campaign + "\n"
    level = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+campaign+"' AND counter=1 AND ANCESTOR IS :1",db.Key.from_path('Level','level'))
    s += "Created by: " + level[0].nick + "\n"
    s += "Date: " + str(level[0].date) + "\n"
    n = 1
    while level.count() > 0:
      s += "-----------------------\n"
      s += level[0].text + "\n"
      n += 1
      level = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+campaign+"' AND counter="+str(n)+"AND ANCESTOR IS :1",db.Key.from_path('Level','level'))
    return s
def load_campaign (pkg,user):
    lines = pkg.replace("\r","").split("\n")
    name = lines[0][lines[0].find(": ") + 2:]
    n = 1
    breaks = []
    while n < len(lines):
      if "--------" in lines[n]: breaks.append(n)
      n += 1
    breaks.append(len(lines))
    for b in range(len(breaks) - 1):
      create_level('\n'.join(lines[breaks[b] + 1:breaks[b + 1]]),name,b + 1,user.user_id(),user.nickname()).put()
class Game (webapp.RequestHandler):
  def post(self):
    info = self.request.get('info')
    infoarray = info.split(' ')
    lastscore = self.request.get('score')
    scorearray = lastscore.split(' ')
    campaign = infoarray[0]
    counter = int(infoarray[1])
    user = users.get_current_user()
    rminloss = [99999,"null"]
    rmaxratio = [0,"null"]
    rmintime = [99999,"null"]
    rminrt = [99999,"null"]
    try:
    # Destroy inferior saves for this map
      existing_saves = db.GqlQuery("SELECT * FROM Savedata WHERE player='"+user.user_id()+"' AND campaign='"+str(campaign)+"' AND ANCESTOR IS :1",db.Key.from_path('Savedata','savedata'))
      for save in existing_saves:
        if save.counter < counter: save.delete();
    # Create a save
      save = Savedata(parent=db.Key.from_path('Savedata','savedata'))
      save.player = user.user_id()
      save.nick = user.nickname()
      save.campaign = campaign
      save.counter = counter
      save.put()
    except: do_nothing = 1;
    # Put our score into the database
    if len(scorearray) >= 5:
      try:
        score = Result(parent=db.Key.from_path('Result','result'))
        score.player = user.user_id()
        score.nick = user.nickname()
        score.campaign = campaign
        score.win = int(scorearray[0])
        score.counter = int(counter) if score.win != 1 else int(counter - 1)
        score.friendly_losses = int(scorearray[1])
        score.enemy_losses = int(scorearray[2])
        score.time = int(scorearray[3])
        score.realtime = int(scorearray[4])
        score.put()
      except: do_nothing = 1
    message = self.request.get('message')
    # Can we, and should we, edit the level?
    wecanedit = 0
    if len(infoarray) > 2:
      currentlevel = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+campaign+"' AND counter="+str(counter)+" AND ANCESTOR IS :1",db.Key.from_path('Level','level'))
      wecanedit = 0
      if currentlevel.count() >= 1 and currentlevel[0].owner == user.user_id(): wecanedit = 1
      elif currentlevel.count() == 0:
        same_campaign = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+campaign+"' AND ANCESTOR IS :1",db.Key.from_path('Level','level'))
        if same_campaign.count() >= 1 and same_campaign[0].owner == user.user_id(): wecanedit = 1 # Adding to a campaign
        if same_campaign.count() == 0: wecanedit = 1 # Creating a new campaign
    # Make sure the user owns the level
    if wecanedit == 1:
      # Save changes to edited level if necessary and possible (ie. user owns the level)
      if infoarray[2] == 'save':
        data = self.request.get('data').replace('\r','') #Stupid carriage returns...
        for c in currentlevel: c.delete()
        create_level(data,campaign,counter,user.user_id(),user.nickname()).put() # Put in our updated level
      # Is the level being removed? If so, move all the levels after it by one to fill in the space
      if infoarray[2] == 'delete':
        while currentlevel.count() > 0: currentlevel[0].delete()
        laterlevels = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+campaign+"' AND counter>"+str(counter)+" AND ANCESTOR IS :1",db.Key.from_path('Level','level'))
        if laterlevels.count() > 0:
          for level in laterlevels:
              level.delete()
              level.counter -= 1
              db.put(level)
        # Move the player's in game progress back by one
        if counter > 1: counter -= 1 
        # Also, move the savepoint back by one
        existing_saves = db.GqlQuery("SELECT * FROM Savedata WHERE player='"+user.user_id()+"' AND campaign='"+str(campaign)+"' AND ANCESTOR IS :1",db.Key.from_path('Savedata','savedata'))
        for save in existing_saves:
          save.delete()
          if save.counter > counter: save.counter -= 1
          if save.counter > 1: db.put(save)
    # Get a list of all scores for the level
    results = db.GqlQuery("SELECT * FROM Result WHERE campaign='"+str(campaign)+"' AND counter="+str(counter)+" AND win=1 AND ANCESTOR IS :1",db.Key.from_path('Result','result'))
    for i in results:
      if i.friendly_losses < rminloss[0]: rminloss = [i.friendly_losses,i.nick]
      if i.enemy_losses / (i.friendly_losses + 0.01) > rmaxratio[0]:
        rmaxratio = [i.enemy_losses / (i.friendly_losses + 0.01),i.nick]
      if i.time < rmintime[0]: rmintime = [i.time,i.nick]
      if i.realtime * 0.001 < rminrt[0]: rminrt = [i.realtime * 0.001,i.nick]
    #Grab the level data
    currentlevel = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+campaign+"' AND counter="+str(counter)+"AND ANCESTOR IS :1",db.Key.from_path('Level','level'))
    if currentlevel.count() == 0: self.redirect('/startscreen')
    else:
      # Set specific variables and initialize the level
      init_vars = 'minloss = [' + str(rminloss[0]) + ",'" + rminloss[1] + "'];\n"
      init_vars += 'maxratio = [' + str(rmaxratio[0]) + ",'" + rmaxratio[1] + "'];\n"
      init_vars += 'mintime = [' + str(rmintime[0]) + ",'" + rmintime[1] + "'];\n"
      init_vars += 'minrt = [' + str(rminrt[0]) + ",'" + rminrt[1] + "'];\n"
      # If we lost, go straight to time = 0 since there's no point repeating the story
      init_vars += "start_time = -1;\n" if len(scorearray) < 5 or scorearray[0] == "1" else "start_time = 0;\n"
      init_vars += "campaign = '" + campaign + "';\ncounter = " + str(counter) + ";\n"
      #Is the level editable?
      if currentlevel[0].owner == user.user_id(): init_vars += "edit_status = 'CAN';"
      else: init_vars += "edit_status = 'CANNOT';"
      campaign = package_campaign(campaign) if user.user_id() == currentlevel[0].owner else ""
      level = currentlevel[0].text
      self.response.out.write(open('template.html').read() % (init_vars,"javascript/main.js",level,campaign))
class Editor (webapp.RequestHandler):
  def post(self):
    user = users.get_current_user()
    message = self.request.get('message')
    messagearray = message.split(' ')
    campaign = messagearray[0]
    counter = int(messagearray[1])
    # Edit the level
    # Make sure the user owns the level
    currentlevel = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+campaign+"' AND counter="+str(counter)+" AND ANCESTOR IS :1",db.Key.from_path('Level','level'))
    wecanedit = 0
    if currentlevel.count() >= 1 and currentlevel[0].owner == user.user_id(): wecanedit = 1
    elif currentlevel.count() == 0:
      same_campaign = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+campaign+"' AND ANCESTOR IS :1",db.Key.from_path('Level','level'))
      if same_campaign.count() >= 1 and same_campaign[0].owner == user.user_id(): wecanedit = 1 # Adding to a campaign
      if same_campaign.count() == 0: wecanedit = 1 # Creating a new campaign
    if wecanedit == 1:
      default_data = open('default_level.txt').read()
      # Is a new level being created? If so, move all the levels after it by one to make room
      if messagearray[2] == 'add':
        laterlevels = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+campaign+"' AND counter>="+str(counter)+" AND ANCESTOR IS :1",db.Key.from_path('Level','level'))
        for level in laterlevels:
          level.delete()
          level.counter += 1
          db.put(level)
        # Also, move the savepoint ahead by one if necessary
        existing_saves = db.GqlQuery("SELECT * FROM Savedata WHERE player='"+user.user_id()+"' AND campaign='"+str(campaign)+"' AND ANCESTOR IS :1",db.Key.from_path('Savedata','savedata'))
        for save in existing_saves:
          save.delete()
          if save.counter < counter: save.counter += 1
          if save.counter > 1: db.put(save)
        # If we're adding a level, copy in the classes but make everything else default
        if counter == 1:
          create_level(default_data,campaign,counter,user.user_id(),user.nickname()).put() # Creating new campaign
        else: 
          prevlevel = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+campaign+"' AND counter>="+str(counter - 1)+" AND ANCESTOR IS :1",db.Key.from_path('Level','level'))
          class_slice = '##classes##\n' + prevlevel[0].classes;
          replace_slice = default_data[default_data.find('##classes##'):default_data.find('##',default_data.find('##classes##') + 11)]
          create_level(default_data.replace(replace_slice,class_slice),campaign,counter,user.user_id(),user.nickname()).put()
    #Grab the level data
    currentlevel = db.GqlQuery("SELECT * FROM Level WHERE campaign='"+campaign+"' AND counter="+str(counter)+"AND ANCESTOR IS :1",db.Key.from_path('Level','level'))
    if currentlevel.count() == 0: self.redirect('/startscreen')
    else:
      # Set specific variables and initialize the level
      init_vars = "var campaign = '" + campaign + "';\nvar counter = " + str(counter) + ";\n"
      init_vars += "var edit_status = 2;"
      level = currentlevel[0].text
      campaign = package_campaign(campaign) if user.user_id() == currentlevel[0].owner else ""
      self.response.out.write(open('template.html').read() % (init_vars,"javascript/editor.js",level,campaign));
application = webapp.WSGIApplication([('/startscreen',Startscreen),('/play',Game),('/',MainPage),('/edit',Editor),('/devguide',Devguide),('/example',Example)],debug=True)

def main(): run_wsgi_app(application)

if __name__ == "__main__":
    main()
