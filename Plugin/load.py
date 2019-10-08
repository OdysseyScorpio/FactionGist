import sys
import os
import ttk
import Tkinter as tk
import tkMessageBox
from ttkHyperlinkLabel import HyperlinkLabel
from config import applongname, appversion
import myNotebook as nb
import json
import requests
import zlib
import re
import webbrowser

this = sys.modules[__name__]
this.apiURL = "http://factiongist.herokuapp.com"
FG_VERSION = "0.0.2"


def plugin_start(plugin_dir):
    awake = requests.get(this.apiURL)
    check_version()
    return 'FactionGist'


def plugin_prefs(parent):
    PADX = 10  # formatting
    frame = nb.Frame(parent)
    frame.columnconfigure(1, weight=1)
    HyperlinkLabel(frame, text='FactionGist GitHub', background=nb.Label().cget('background'),
                   url='https://github.com/OdysseyScorpio/FactionGist', underline=True).grid(columnspan=2, padx=PADX, sticky=tk.W)
    nb.Label(frame, text="FactionGist - crazy-things-might-happen-pre-pre-alpha release Version {VER}".format(
        VER=FG_VERSION)).grid(columnspan=2, padx=PADX, sticky=tk.W)
    nb.Label(frame).grid()  # spacer
    nb.Button(frame, text="UPGRADE", command=upgrade_callback).grid(
        columnspan=2, padx=PADX, sticky=tk.W)
    return frame


def check_version():
    response = requests.get(this.apiURL + "/version")
    version = response.content
    if version != FG_VERSION:
        upgrade_callback()


def upgrade_callback():
    this_fullpath = os.path.realpath(__file__)
    this_filepath, this_extension = os.path.splitext(this_fullpath)
    corrected_fullpath = this_filepath + ".py"
    try:
        response = requests.get(this.apiURL + "/download")
        if (response.status_code == 200):
            with open(corrected_fullpath, "wb") as f:
                f.seek(0)
                f.write(response.content)
                f.truncate()
                f.flush()
                os.fsync(f.fileno())
                this.upgrade_applied = True  # Latch on upgrade successful
                msginfo = ['Upgrade has completed sucessfully.',
                           'Please close and restart EDMC']
                tkMessageBox.showinfo("Upgrade status", "\n".join(msginfo))
            sys.stderr.write("Finished plugin upgrade!\n")

        else:
            msginfo = ['Upgrade failed. Bad server response',
                       'Please try again']
            tkMessageBox.showinfo("Upgrade status", "\n".join(msginfo))
    except:
        sys.stderr.writelines(
            "Upgrade problem when fetching the remote data: {E}\n".format(E=sys.exc_info()[0]))
        msginfo = ['Upgrade encountered a problem.',
                   'Please try again, and restart if problems persist']
        tkMessageBox.showinfo("Upgrade status", "\n".join(msginfo))


def news_update():
    this.parent.after(300000, news_update)
    try:
        response = requests.get(this.apiURL + "/news")
        updatemsg = json.loads(response.content).get("update").get("update")
        link = json.loads(response.content).get("update").get("link")
        versionmsg = json.loads(response.content).get(
            "update").get("versionmsg")
        motd = json.loads(response.content).get("update").get("motd")
        response = requests.get(this.apiURL + "/listening")
        this.listening = json.loads(response.content)
        if (response.status_code == 200):
            this.news_headline['text'] = updatemsg
            this.news_headline['url'] = link
            statusmsg = "%s%s%s%s" % (versionmsg, this.FG_VERSION, " ", motd)
            this.status['text'] = statusmsg
        else:
            this.news_headline['text'] = "News refresh Failed"
    except:
        this.news_headline['text'] = "Could not update news from FactionGist server"


def dashboard_entry(cmdr, is_beta, entry):
    this.cmdr = cmdr


def journal_entry(cmdr, is_beta, system, station, entry, state):
    # Currently only post MissionComplete and Docked events
    # ToDo Add in Trading, Bounty and Carto Events
    # if entry['event'] in ['MissionComplete', 'Docked']:
    this.cmdr = cmdr
    entry['commandername'] = cmdr
    entry['pluginversion'] = FG_VERSION
    transmit_json = json.dumps(entry)
    url_jump = this.apiURL + '/events'
    headers = {'content-type': 'application/json'}
    response = requests.post(
        url_jump, data=transmit_json, headers=headers, timeout=7)


def plugin_stop():
    sys.stderr.writelines("Good bye commander")
