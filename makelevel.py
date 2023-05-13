rminloss = [0, "me"]
rmaxratio = [999, "me"]
rmintime = [0, "me"]
rminrt = [0, "rt"]
campaign = 'tutorial'
counter = '0'
scorearray = []

# Set specific variables and initialize the level
init_vars = 'minloss = [' + str(rminloss[0]) + ",'" + rminloss[1] + "'];\n"
init_vars += 'maxratio = [' + str(rmaxratio[0]) + ",'" + rmaxratio[1] + "'];\n"
init_vars += 'mintime = [' + str(rmintime[0]) + ",'" + rmintime[1] + "'];\n"
init_vars += 'minrt = [' + str(rminrt[0]) + ",'" + rminrt[1] + "'];\n"
# If we lost, go straight to time = 0 since there's no point repeating the story
init_vars += "edit_status = 'CANNOT';"
init_vars += "start_time = -1;\n" if len(scorearray) < 5 or scorearray[0] == "1" else "start_time = 0;\n"
init_vars += "campaign = '" + campaign + "';\ncounter = " + str(counter) + ";\n"

campaign = ""

import os
if 'levels' not in os.listdir():
    os.mkdir('levels')
index = ['<h3>Campaigns</h3>']
for filename in os.listdir('data'):
    if filename[-4:] == '.txt':
        campaign_name = filename[:-4]
        if campaign_name not in os.listdir('levels'):
            os.mkdir(os.path.join('levels', campaign_name))
        levels = open(os.path.join('data', filename)).read().split('\n-----------------------\n')[1:]
        index.append('<a href="levels/{0}/0.html">{0}</a>'.format(campaign_name))
        for i, level in enumerate(levels):
            current_location = os.path.join('levels', campaign_name, str(i))+'.html'
            next_location = os.path.join('levels', campaign_name, str(i+1))+'.html' if i < len(levels)-1 else 'index.html'
            location_setter_script = 'current_location = "../../{}"; next_location = "../../{}";'.format(current_location, next_location)
            level_html = open('template.html').read() % (init_vars, "../../javascript/main.js", location_setter_script, level, campaign)
            open(current_location, 'w').write(level_html)
open('index.html', 'w').write('\n'.join(index))
