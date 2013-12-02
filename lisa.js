define(['require', 'github:janesconference/KievII@0.6.0/kievII', 'github:janesconference/nu.js/nu','./lisa.html!text', './lisa.css!text'], function(require, K2, Note, htmlTemp, cssTemp) {

    var pluginConf = {
        name: "Lisa",
        osc: false,
        version: '0.0.1-alpha1',
        ui: {
            type: 'div',
            width: 464,
            height: 316,
            html: htmlTemp,
            css: cssTemp
        }
    };

    var pluginFunction = function(args) {

        this.name = args.name;
        this.id = args.id;
        this.context = args.audioContext;
        this.domEl = args.div;

        this.note = new Note({frequency:440});

        this.midiHandler = args.MIDIHandler;

        this.playing = false;

        this.tolerance = 200; // ms
        this.steps = 8; // TODO this will be variable

        this.schedulerCursor = 0; // current playing position
        this.cursorIncrement = 0;

        this.incrementScheduleCursor = function (){
            this.schedulerCursor = (this.schedulerCursor + 1) % this.steps;
            this.cursorIncrement += 1;
        };

        this.resetScheduleCursor = function () {
            this.schedulerCursor = 0;
        };

        this.resetIncrementCursor = function () {
            this.cursorIncrement = 0;
        };

        this.play = function (startTime, interval) {

            // Send a deferred MIDI, starting in: tolerance (delay) in seconds + start time + interval in seconds * step
            var when = this.tolerance / 1000 + startTime + (interval * this.cursorIncrement) / 1000;

            // Read the message description from the status
            var note = this.status.notes[this.schedulerCursor];
            var vel = this.status.velocities[this.schedulerCursor];
            var ch = this.status.channels[this.schedulerCursor];

            // Build the message
            console.log ("sending on message, number, when", this.schedulerCursor , when);
            var msg = { type: "noteon",
                        channel: ch,
                        pitch: note,
                        velocity: vel
            }
            this.midiHandler.sendMIDIMessage (msg, when);

            // TODO probably we need to send a midi off when the note ends.
            // Here we need to decide if continue the note until a new one starts
            // Or to kill the note at the start of the new step (aka we need a switch)
            console.log ("sending off message, number, when", this.schedulerCursor , when + interval / 1000);
            msg = { type: "noteoff",
                channel: ch,
                pitch: note,
                velocity: vel
            }
            this.midiHandler.sendMIDIMessage (msg, when + interval / 1000);

            this.incrementScheduleCursor();

        }.bind(this);

        this.startScheduler = function () {
            this.playing = true;
            var interval = (60 / this.status.tempo * 1000) / 2; // Beat interval in ms
            console.log ("Interval is: " + interval + " milliseconds");
            var timeNow = this.context.currentTime;
            this.schedulerInterval = setInterval(this.play, interval, timeNow, interval);
        };

        this.stopScheduler = function () {
            this.pauseScheduler();
            this.resetScheduleCursor();
        };

        this.pauseScheduler = function () {
            this.playing = false;
            this.resetIncrementCursor();
            clearInterval(this.schedulerInterval);
        };

        var canvas = this.domEl.querySelector(".bars");
        this.select = this.domEl.querySelector("select");
        this.patternNumInput = this.domEl.querySelector(".pattern-num");
        this.patternTotalInput = this.domEl.querySelector(".patterns-total");
        this.tempoInput = this.domEl.querySelector(".tempo");
        this.octaveInput = this.domEl.querySelector(".octave");
        this.stepLegendList = this.domEl.querySelectorAll('.step-legend');
        this.octaveLegendList = this.domEl.querySelectorAll('.step-octave-legend');
        this.staticLegends = {
            'pitch': this.domEl.querySelector('.note-legend-container'),
            'velocity': this.domEl.querySelector('.velocity-legend-container'),
            'channel': this.domEl.querySelector('.channel-legend-container')
        };
        this.colorSchemas = {
            'velocity': {color: 'rgba(100,210,0, 0.8)', lightColor: 'rgba(140,210,0, 0.8)', lighterColor: 'rgba(165,210,0,0.8)', lightestColor: 'rgba(190,210,0,0.8)'},
            'channel': {color: 'rgba(255, 69, 0, 0.8)', lightColor: 'rgba(255, 140, 0, 0.8)', lighterColor: 'rgba(255, 165, 0, 0.8)', lightestColor: 'rgba(255, 190, 0, 0.8)'},
            'pitch': {color: 'rgba(0,100,210, 0.8)', lightColor: 'rgba(0,140,210, 0.8)', lighterColor: 'rgba(0,165,210,0.8)', lightestColor: 'rgba(0,190,210,0.8)'}
        };

        // Helper functions, adapted from jQuery

        var AddClassToElement = function (elem,value){
            var rspaces = /\s+/;
            var classNames = (value || "").split( rspaces );
            var className = " " + elem.className + " ",
                setClass = elem.className;
            for ( var c = 0, cl = classNames.length; c < cl; c++ ) {
                if ( className.indexOf( " " + classNames[c] + " " ) < 0 ) {
                    setClass += " " + classNames[c];
                }
            }
            elem.className = setClass.replace(/^\s+|\s+$/g,'');//trim
        }

        var RemoveClassFromElement = function (elem,value){
            var rspaces = /\s+/;
            var rclass = /[\n\t]/g
            var classNames = (value || "").split( rspaces );
            var className = (" " + elem.className + " ").replace(rclass, " ");
            for ( var c = 0, cl = classNames.length; c < cl; c++ ) {
                className = className.replace(" " + classNames[c] + " ", " ");
            }
            elem.className = className.replace(/^\s+|\s+$/g,'');//trim
        }

        this.reInitBars = function (colors, valueArr, translateFunc) {
            for (var i = 0; i < this.barElements.length; i+=1) {
                var el = this.barElements[i];
                el.color = colors.color;
                el.lightColor = colors.lightColor;
                el.lighterColor = colors.lighterColor;
                el.lightestColor = colors.lightestColor;
                if (!valueArr[i]) {
                    valueArr[i] = 0;
                }
                var value = valueArr[i];
                if (typeof translateFunc === 'function') {
                    value = translateFunc.apply(this, [value]);
                }
                this.ui.setValue ({elementID: el.ID, slot: 'barvalue', value: value});
            }
            this.ui.refresh();
        };

        this.reInitOctaveLegend = function (valueArr) {
            for (var i = 0; i < this.barElements.length; i+=1) {
                // TODO this.refreshOctaveLegend (i, valueArr[i].octave);
                this.refreshOctaveLegend (i, Math.floor((valueArr[i] + 1) / 12) - 1);
            }
        };

        this.switchPage = function () {
            // Hide / show static legend classes
            for (legendContainerEl in this.staticLegends) {
                if (legendContainerEl !== this.lisaStatus.page) {
                    // hide
                    AddClassToElement(this.staticLegends[legendContainerEl], 'hidden');
                }
                else {
                    // show
                    RemoveClassFromElement(this.staticLegends[legendContainerEl], 'hidden');
                }
            }

            switch (this.lisaStatus.page) {
                case 'velocity':
                    // Disable the octave input
                    this.octaveInput.readOnly = true;
                    this.reInitBars(this.colorSchemas.velocity, this.lisaStatus.matrix[this.lisaStatus.currPattern].velocity);
                    break;
                case 'channel':
                    // Disable the octave input
                    this.octaveInput.readOnly = true;
                    this.reInitBars(this.colorSchemas.channel, this.lisaStatus.matrix[this.lisaStatus.currPattern].channel);
                    break;
                case 'pitch':
                    // Enable the octave input
                    this.octaveInput.readOnly = false;
                    var translate = function (value) {
                        var ranged_value = ((value + 1) % 12) / 12;
                        var note_octave = Math.floor((value + 1) / 12) - 1;
                        this.tempOctave = note_octave;
                        console.log ("value / ranged", value, ranged_value);
                        return ranged_value;
                    }
                    this.reInitBars(this.colorSchemas.pitch, this.lisaStatus.matrix[this.lisaStatus.currPattern].pitch, translate);
                    this.reInitOctaveLegend(this.lisaStatus.matrix[this.lisaStatus.currPattern].pitch);
                    this.tempOctave = this.lisaStatus.octave;
                    break;
            }
        }

        this.setRedrawPattern = function (newPattern) {
            if (this.lisaStatus.currPattern !== newPattern) {
                this.patternNumInput.value = newPattern;
                this.lisaStatus.currPattern = newPattern;
                this.switchPage();
            }
        }

        this.setTotalPatterns = function (newPattern) {
            var np = parseInt(newPattern, 10);
            if (!isNaN(np) && np != this.lisaStatus.numPatterns && np < 32 /* TODO */) {
                this.lisaStatus.numPatterns = np;
                if (this.lisaStatus.numPatterns <= this.lisaStatus.currPattern) {
                    this.setRedrawPattern(np - 1);
                }
            }
            else {
                this.patternTotalInput.value = this.lisaStatus.numPatterns;
            }
        }

        this.setTempo = function (tempo) {
            var nt = parseInt (tempo, 10);
            if (!isNaN(nt) && nt != this.lisaStatus.tempo && (nt > 20 && nt < 300) /* TODO */) {
                this.tempo = nt;
            }
            else {
                this.tempoInput.value = this.lisaStatus.tempo;
            }
        }

        this.setOctave = function (octave) {
            var no = parseInt (octave, 10);
            if (!isNaN(no) && no != this.lisaStatus.octave && no < 10 /* TODO */) {
                this.lisaStatus.octave = no;
                this.tempOctave = this.lisaStatus.octave;
            }
            else {
                this.octaveInput.value = this.lisaStatus.octave;
            }
        }

        this.select.addEventListener("change",function(e) {
            console.log ("Changed value of dropdown", e.target.value);
            var page_selected = e.target.value.toLowerCase();
            if (page_selected !== this.lisaStatus.page) {
                this.lisaStatus.page = page_selected;
                this.switchPage ();
            }
        }.bind(this));

        this.patternNumInput.addEventListener("change",function(e) {
            var np = parseInt(e.target.value, 10);
            if (!isNaN(np) && np != this.lisaStatus.currPattern && np < this.lisaStatus.numPatterns) {
                this.setRedrawPattern (np);
            }
            else {
                e.target.value = this.lisaStatus.currPattern;
            }
        }.bind(this));

        this.patternTotalInput.addEventListener("change",function(e) {
            this.setTotalPatterns(e.target.value);
        }.bind(this));

        this.tempoInput.addEventListener("change",function(e) {
            this.setTempo(e.target.value);
        }.bind(this));

        this.octaveInput.addEventListener("change",function(e) {
            this.setOctave(e.target.value);
        }.bind(this));

        this.refreshNoteLegend = function (normal_value, midi_note, bar_num) {
            // note name
            var name;
            if (midi_note === -1 || normal_value === 0) {
                name = "--";
            }
            else {
                var nn = Note.prototype.midi2Name(midi_note);
                name = nn.name.split('/')[0];
            }
            console.log ("Note name is: ", name);

            this.stepLegendList[bar_num].innerHTML = name;
        };

        this.refreshOctaveLegend = function (step, octave) {
            var octValue =  octave;
            if (octave === -1) {
               octValue = ''; 
            }
            this.octaveLegendList[step].value = octValue;
        }

        this.lisaStatus = {
            matrix: [],
            page: 'pitch',
            numPatterns: 4,
            currPattern: 0,
            tempo: 60,
            octave: 4
        }
        this.tempOctave = this.lisaStatus.octave;

        for (var i = 0; i < 32; i+=1 ) {
            this.lisaStatus.matrix.push ({
                pitch: [-1,-1,-1,-1,-1,-1,-1,-1],
                velocity: [0.75,0.75,0.75,0.75,0.75,0.75,0.75,0.75],
                channel: [0.0625,0.0625,0.0625,0.0625,0.0625,0.0625,0.0625,0.0625]
            });
        }

        this.viewWidth = canvas.width;
        this.viewHeight = canvas.height;
        console.log (this.viewWidth, this.viewHeight);
        this.ui = new K2.UI ({type: 'CANVAS2D', target: canvas});

        var barWidth =  31;
        var spaceWidth = 5;

        var clickBarArgs = {
            ID: "testClickBar",
            left : 0,
            top : 8,
            height: this.viewHeight - 36,
            width: barWidth,
            onValueSet: function (slot, value, element) {

                var normal_value;
                var bar_num = parseInt (element.split("_")[1], 10);
                console.log ("Bar " + bar_num + " set at: " + value * 8);

                if (this.lisaStatus.page === 'pitch') {
                    normal_value = Math.round(value * 12) / 12;
                    if (value !== normal_value) {
                        this.ui.setValue ({elementID: element, slot: slot, value: normal_value, fireCallback:false});
                    }
                    else {

                        var midi_note = normal_value == 0 ? -1 : (normal_value * 12 - 1) + (this.tempOctave + 1)* 12;
                        console.log ("Setting note ", midi_note);

                        this.refreshNoteLegend (normal_value, midi_note, bar_num);

                        this.lisaStatus.matrix[this.lisaStatus.currPattern].pitch[bar_num] = midi_note;


                    }
                }
                else if (this.lisaStatus.page === 'velocity') {
                    var vel = Math.round (value*127);
                    this.lisaStatus.matrix[this.lisaStatus.currPattern].velocity[bar_num] = value;
                    this.stepLegendList[bar_num].innerHTML = vel;
                }
                else if (this.lisaStatus.page === 'channel') {
                    normal_value = Math.round(value * 16) / 16;
                    if (value !== normal_value) {
                        this.ui.setValue ({elementID: element, slot: slot, value: normal_value, fireCallback:false});
                    }
                    else {
                        this.lisaStatus.matrix[this.lisaStatus.currPattern].channel[bar_num] = value;
                        this.stepLegendList[bar_num].innerHTML = normal_value * 16;
                    }
                }

                this.ui.refresh();
            }.bind(this),
            isListening: true
        };

        this.barElements = [];

        for (var i = 0; i < 8; i += 1) {
            clickBarArgs.ID = "bar_" + i;
            clickBarArgs.left = (i * barWidth + (i+1) * spaceWidth);
            var el = new K2.ClickBar(clickBarArgs);
            this.ui.addElement(el);
            //this.ui.setValue ({elementID: clickBarArgs.ID, slot: 'barvalue', value: 0.5});
            this.barElements.push(el);
        }

        // Init function
        this.setRedrawPattern("0");
        this.setTotalPatterns();
        this.setTempo();
        this.setOctave();

        args.hostInterface.setDestructor (function () {
            this.stopScheduler();
        }.bind(this));

        // Initialization made it so far: plugin is ready.
        args.hostInterface.setInstanceStatus ('ready');
    };


    var initPlugin = function(initArgs) {
        pluginFunction.call (this, initArgs);
    };

    return {
        initPlugin: initPlugin,
        pluginConf: pluginConf
    };
});
