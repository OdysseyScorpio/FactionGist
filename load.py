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
FG_VERSION = "0.0.3"
availableFactions = tk.StringVar()
try:
    this_fullpath = os.path.realpath(__file__)
    this_filepath, this_extension = os.path.splitext(this_fullpath)
    config_file = this_filepath + "config.json"
    with open(config_file) as f:
        data = json.load(f)
    availableFactions.set(data)
except:
    availableFactions.set("everyone")
if(availableFactions.get() == "everyone"):
    msginfo = ['Please update your Reporting Faction.',
               '\nYou can report to one or many factions,'
               'simply separate each faction with a comma.\n'
               '\nFile > Settings > FactionGist']
    tkMessageBox.showinfo("Reporting Factions", "\n".join(msginfo))


def plugin_app(parent):
    this.parent = parent
    this.frame = tk.Frame(parent)
    filter_update()
    return this.frame


def filter_update():
    this.parent.after(300000, filter_update)
    response = requests.get(this.apiURL + "/listeningFor")
    if(response.status_code == 200):
        this.listening = response.content


def plugin_start(plugin_dir):
    awake = requests.get(this.apiURL)
    check_version()
    return 'FactionGist'


def plugin_prefs(parent):
    PADX = 10  # formatting
    frame = nb.Frame(parent)
    frame.columnconfigure(5, weight=1)
    HyperlinkLabel(frame, text='FactionGist GitHub', background=nb.Label().cget('background'),
                   url='https://github.com/OdysseyScorpio/FactionGist', underline=True).grid(columnspan=2, padx=PADX, sticky=tk.W)
    nb.Label(frame, text="FactionGist - crazy-things-might-happen-pre-pre-alpha release Version {VER}".format(
        VER=FG_VERSION)).grid(columnspan=2, padx=PADX, sticky=tk.W)
    nb.Label(frame).grid()  # spacer
    nb.Button(frame, text="UPGRADE", command=upgrade_callback).grid(row=10, column=0,
                                                                    columnspan=2, padx=PADX, sticky=tk.W)

    nb.lblReportingFactions = tk.Label(frame)
    nb.lblReportingFactions.grid(
        row=3, column=0, columnspan=2, padx=PADX, sticky=tk.W)
    nb.lblReportingFactions.config(text='Factions I am supporting')
    nb.Entry1 = tk.Entry(frame, textvariable=availableFactions)
    nb.Entry1.grid(row=4, column=0, columnspan=2, padx=PADX, sticky=tk.W+tk.E)

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


def dashboard_entry(cmdr, is_beta, entry):
    this.cmdr = cmdr


def journal_entry(cmdr, is_beta, system, station, entry, state):
    if entry['event'] in this.listening:
        entry['commanderName'] = cmdr
        entry['pluginVersion'] = FG_VERSION
        entry['currentSystem'] = system
        entry['currentStation'] = station
        entry['reportingFactions'] = [availableFactions.get()]
        transmit_json = json.dumps(entry)
        url_jump = this.apiURL + '/events'
        headers = {'content-type': 'application/json'}
        response = requests.post(
            url_jump, data=transmit_json, headers=headers, timeout=7)


def plugin_stop():
    sys.stderr.writelines("\nGood bye commander\n")
    config = availableFactions.get()
    this_fullpath = os.path.realpath(__file__)
    this_filepath, this_extension = os.path.splitext(this_fullpath)
    config_file = this_filepath + "config.json"
    with open(config_file, 'w') as f:
        json.dump(config, f)
