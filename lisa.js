define(['require', 'github:janesconference/KievII@0.6.0/kievII', 'github:janesconference/nu.js/nu','./lisa.html!text', './lisa.css!text'], function(require, K2, Note, htmlTemp, cssTemp) {

    var pluginConf = {
        name: "Lisa",
        osc: false,
        version: '0.0.2',
        ui: {
            type: 'div',
            width: 464,
            height: 316,
            html: htmlTemp,
            css: cssTemp
        }
    };

    var pluginFunction = function(args) {

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
        };

        var RemoveClassFromElement = function (elem,value){
            var rspaces = /\s+/;
            var rclass = /[\n\t]/g;
            var classNames = (value || "").split( rspaces );
            var className = (" " + elem.className + " ").replace(rclass, " ");
            for ( var c = 0, cl = classNames.length; c < cl; c++ ) {
                className = className.replace(" " + classNames[c] + " ", " ");
            }
            elem.className = className.replace(/^\s+|\s+$/g,'');//trim
        };

        this.name = args.name;
        this.id = args.id;
        this.context = args.audioContext;
        this.domEl = args.div;

        this.note = new Note({frequency:440});

        this.midiHandler = args.MIDIHandler;

        this.playing = false;

        this.tolerance = 750;

        // Number of steps in a pattern
        this.steps = 8;

        // current playing position
        this.cursorIncrement = 0;
        this.patternCursor = 0;
        this.stepCursor = 0;

        this.lastHighlightedNote = 7;

        this.incrementScheduleCursor = function (){

            var stop = false;

            if (this.steps - 1 === this.stepCursor) {
                // We must increment the pattern
                if (this.patternCursor + 1 >= this.lisaStatus.numPatterns) {
                    // We are at the end of patterns
                    if (this.lisaStatus.loop) {
                        // Loop, restart from 0.
                        this.patternCursor = 0;
                        this.stepCursor = 0;
                    }
                    else {
                        // Must stop here
                        stop = true;
                    }
                }
                else {
                    // We have further patterns; reset the stepCursor only
                    this.patternCursor += 1;
                    this.stepCursor = 0;
                }
           }
           else {
            // We can increment the stepCursor
            this.stepCursor += 1;
           }
           this.cursorIncrement += 1;

            RemoveClassFromElement (this.stepLegendList[this.lastHighlightedNote], "note-highlight");
            this.lastHighlightedNote = (this.lastHighlightedNote + 1) % this.steps;
            AddClassToElement (this.stepLegendList[this.lastHighlightedNote], "note-highlight");

            if (stop) {
                this.stopScheduler();
                return;
            }

            if (this.lastHighlightedNote === 0) {
                // Start of pattern
                this.setRedrawPattern(this.patternCursor);
            }

        };

        this.resetScheduleCursor = function () {
            this.patternCursor = 0;
            this.stepCursor = 0;
            this.lastHighlightedNote = 7;
            for (var i = 0; i < this.stepLegendList.length; i+=1 ) {
                RemoveClassFromElement (this.stepLegendList[i], "note-highlight");
            }
        };

        this.play = function (startTime, interval) {

            var msgArray = [];
            // MIDI messages to be sent at the end of the step.
            var nextArray = [];

            var sendNote = true;
            // TODO implement a lookahead to see if we should send an off note
            var sendOff = true;

            // Send a deferred MIDI, starting in: tolerance (delay) in seconds + start time + interval in seconds * step
            var when = this.tolerance / 1000 + startTime + (interval * this.cursorIncrement) / 1000;

            // Read the message description from the status
            var note = this.lisaStatus.matrix[this.patternCursor].pitch.semitone[this.stepCursor];

            if (note === -1) {
                sendNote = false;
            }

            var octave = this.lisaStatus.matrix[this.patternCursor].pitch.octave[this.stepCursor];
            var vel = this.lisaStatus.matrix[this.patternCursor].velocity[this.stepCursor] * 127;
            var ch = this.lisaStatus.matrix[this.patternCursor].channel[this.stepCursor] * 16;

            var midi_note = octave * 12 + note;
            var msg;

            if (sendNote) {
                // Build the message
                msg = { type: "noteon",
                            channel: ch,
                            pitch: midi_note,
                            velocity: vel
                };
                msgArray.push(msg);
            }

            if (sendNote && sendOff) {
                msg = { type: "noteoff",
                    channel: ch,
                    pitch: midi_note,
                    velocity: vel
                };
                nextArray.push(msg);
            }

            // See http://www.gweep.net/~prefect/eng/reference/protocol/midispec.html#CC
            for (var ctrlPage = 1; ctrlPage <= 4; ctrlPage+=1) {
                var controller = "ctrl" + ctrlPage;
                var value = this.lisaStatus.matrix[this.patternCursor][controller].values[this.stepCursor];
                if (value) {
                    var type = this.lisaStatus.matrix[this.patternCursor][controller].type;
                    msgArray.push( {
                        type: "controlchange",
                        channel: ch,
                        control: type,
                        value: value * 127 - 1
                    });
                }
            }

            this.midiHandler.sendMIDIMessage (msgArray, when);
            this.midiHandler.sendMIDIMessage (nextArray, when + interval / 1000);

            this.incrementScheduleCursor();

        }.bind(this);

        this.startScheduler = function () {
            this.playing = true;
            var interval = (60 / this.lisaStatus.tempo * 1000) / 2; // Beat interval in ms
            console.log ("Interval is: " + interval + " milliseconds");
            var timeNow = this.context.currentTime;
            this.schedulerInterval = setInterval(this.play, interval, timeNow, interval);
            this.playButton.textContent = "Pause";
        };

        this.stopScheduler = function () {
            this.pauseScheduler();
            this.resetScheduleCursor();
            this.playButton.textContent = "Play";
        };

        this.pauseScheduler = function () {
            this.playing = false;
            clearInterval(this.schedulerInterval);
            this.cursorIncrement = 0;
            this.playButton.textContent = "Play";
        };

        var canvas = this.domEl.querySelector(".bars");
        this.select = this.domEl.querySelector("select");
        this.patternNumInput = this.domEl.querySelector(".pattern-num");
        this.patternTotalInput = this.domEl.querySelector(".patterns-total");
        this.tempoInput = this.domEl.querySelector(".tempo");
        this.stepLegendList = this.domEl.querySelectorAll('.step-legend');
        this.octaveLegendList = this.domEl.querySelectorAll('.step-octave-legend');
        this.octaveInput = this.domEl.querySelector(".octave-inputs");
        this.loop_chk = this.domEl.getElementsByClassName("loop_checkbox")[0];
        this.playButton = this.domEl.querySelector(".play");
        this.stopButton = this.domEl.querySelector(".stop");
        this.dynamicTypeContainer = this.domEl.querySelector(".dynamic-type-container");
        this.dynamicTypeContainerInput = this.domEl.querySelector(".dynamic-type-container input");

        this.staticLegends = {
            'pitch': this.domEl.querySelector('.note-legend-container'),
            'velocity': this.domEl.querySelector('.velocity-legend-container'),
            'channel': this.domEl.querySelector('.channel-legend-container'),
            'ctrl1': this.domEl.querySelector('.velocity-legend-container'),
            'ctrl2': this.domEl.querySelector('.velocity-legend-container'),
            'ctrl3': this.domEl.querySelector('.velocity-legend-container'),
            'ctrl4': this.domEl.querySelector('.velocity-legend-container')
        };
        this.colorSchemas = {
            'velocity': {color: 'rgba(100,210,0, 0.8)', lightColor: 'rgba(140,210,0, 0.8)', lighterColor: 'rgba(165,210,0,0.8)', lightestColor: 'rgba(190,210,0,0.8)'},
            'channel': {color: 'rgba(255, 69, 0, 0.8)', lightColor: 'rgba(255, 140, 0, 0.8)', lighterColor: 'rgba(255, 165, 0, 0.8)', lightestColor: 'rgba(255, 190, 0, 0.8)'},
            'pitch': {color: 'rgba(0,100,210, 0.8)', lightColor: 'rgba(0,140,210, 0.8)', lighterColor: 'rgba(0,165,210,0.8)', lightestColor: 'rgba(0,190,210,0.8)'},
            'ctrl1': {color: 'rgba(100,100,210, 0.8)', lightColor: 'rgba(100,140,210, 0.8)', lighterColor: 'rgba(100,165,210,0.8)', lightestColor: 'rgba(100,190,210,0.8)'},
            'ctrl2': {color: 'rgba(100,100,210, 0.8)', lightColor: 'rgba(100,140,210, 0.8)', lighterColor: 'rgba(100,165,210,0.8)', lightestColor: 'rgba(100,190,210,0.8)'},
            'ctrl3': {color: 'rgba(100,100,210, 0.8)', lightColor: 'rgba(100,140,210, 0.8)', lighterColor: 'rgba(100,165,210,0.8)', lightestColor: 'rgba(100,190,210,0.8)'},
            'ctrl4': {color: 'rgba(100,100,210, 0.8)', lightColor: 'rgba(100,140,210, 0.8)', lighterColor: 'rgba(100,165,210,0.8)', lightestColor: 'rgba(100,190,210,0.8)'}
        };

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
                this.refreshOctaveLegend (i, valueArr.octave[i]);
            }
        };

        this.switchPage = function () {
            if (this.lisaStatus.page.indexOf("ctrl") === 0) {
                // Show the dynamic-type-container
                RemoveClassFromElement(this.dynamicTypeContainer, 'hidden');
                var msgType = this.lisaStatus.matrix[this.lisaStatus.currPattern][this.lisaStatus.page].type;
                this.dynamicTypeContainerInput.value = msgType;
            }
            else {
                // Hide it
                AddClassToElement(this.dynamicTypeContainer, 'hidden');
            }
            // Hide / show static legend classes
            var hidden = 0, shown = 0;
            for (var legendContainerEl in this.staticLegends) {
                if (legendContainerEl !== this.lisaStatus.page) {
                    // hide
                    AddClassToElement(this.staticLegends[legendContainerEl], 'hidden');
                    hidden += 1;
                }
                else {
                    // show
                    RemoveClassFromElement(this.staticLegends[legendContainerEl], 'hidden');
                    shown += 1;
                }
                if ((shown > 0) && (hidden > 0)) {
                    break;
                }
            }

            switch (this.lisaStatus.page) {
                case 'velocity':
                    this.reInitBars(this.colorSchemas.velocity, this.lisaStatus.matrix[this.lisaStatus.currPattern].velocity);
                    break;
                case 'channel':
                    this.reInitBars(this.colorSchemas.channel, this.lisaStatus.matrix[this.lisaStatus.currPattern].channel);
                    break;
                case 'pitch':
                    var translate = function (value) {
                        var ranged_value = (value + 1) / 12;
                        return ranged_value;
                    };
                    this.reInitBars(this.colorSchemas.pitch, this.lisaStatus.matrix[this.lisaStatus.currPattern].pitch.semitone, translate);
                    this.reInitOctaveLegend(this.lisaStatus.matrix[this.lisaStatus.currPattern].pitch);
                    break;
                case 'ctrl1':
                    this.reInitBars(this.colorSchemas.ctrl1, this.lisaStatus.matrix[this.lisaStatus.currPattern].ctrl1.values);
                    break;
                case 'ctrl2':
                    this.reInitBars(this.colorSchemas.ctrl2, this.lisaStatus.matrix[this.lisaStatus.currPattern].ctrl2.values);
                    break;
                case 'ctrl3':
                    this.reInitBars(this.colorSchemas.ctrl3, this.lisaStatus.matrix[this.lisaStatus.currPattern].ctrl3.values);
                    break;
                case 'ctrl4':
                    this.reInitBars(this.colorSchemas.ctrl4, this.lisaStatus.matrix[this.lisaStatus.currPattern].ctrl4.values);
                    break;
            }
        };

        this.setRedrawPattern = function (newPattern, force) {
            if (force || this.lisaStatus.currPattern !== newPattern) {
                this.patternNumInput.value = newPattern;
                this.lisaStatus.currPattern = newPattern;
                this.switchPage();
            }
        };

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
        };

        this.setTempo = function (tempo) {
            var nt = parseInt (tempo, 10);
            if (!isNaN(nt) && nt != this.lisaStatus.tempo && (nt > 20 && nt < 300) /* TODO */) {
                this.lisaStatus.tempo = nt;
            }
            else {
                this.tempoInput.value = this.lisaStatus.tempo;
            }
        };

        this.setLoop = function (loop) {
            if (loop) {
                this.lisaStatus.loop = true;
            }
            else {
                this.lisaStatus.loop = false;
            }
            this.loop_chk.value = this.lisaStatus.loop;
        };

        this.select.addEventListener("change",function(e) {
            console.log ("Changed value of dropdown", e.target.value);
            var page_selected = e.target.value.toLowerCase();
            if (page_selected !== this.lisaStatus.page) {
                this.lisaStatus.page = page_selected;
                this.switchPage ();
            }
        }.bind(this));

        this.octaveInput.addEventListener("change",function(e) {
            console.log ("Changed value of one of the octave input", e.target.id, e.target.value);
            var value = e.target.value;
            var inputN = e.srcElement.className.split(" ")[1].split("-")[1];
            value = parseInt(value, 10);
            if (isNaN(value)) {
                this.octaveLegendList[inputN].value = this.lisaStatus.matrix[this.lisaStatus.currPattern].pitch.octave[inputN];
                return;
            }
            inputN = parseInt(inputN, 10);
            this.lisaStatus.matrix[this.lisaStatus.currPattern].pitch.octave[inputN] = value;
            // Change note legend
            var st = this.lisaStatus.matrix[this.lisaStatus.currPattern].pitch.semitone[inputN];
            this.refreshNoteLegend (st, value, inputN);

        }.bind(this));

        this.dynamicTypeContainer.addEventListener("change",function(e) {
            console.log ("Changed value of the type input", e.target.id, e.target.value);
            var value = e.target.value;
            var page = this.lisaStatus.page;
            value = parseInt(value, 10);
            if (isNaN(value)) {
                this.dynamicTypeContainerInput.value = this.lisaStatus.matrix[this.lisaStatus.currPattern][page].type;
                return;
            }
            console.log ("Type for " + page + " is " + value);
            this.lisaStatus.matrix[this.lisaStatus.currPattern][page].type = value;
        }.bind(this));

        this.loop_chk.addEventListener("change",function(e) {
            this.lisaStatus.loop = e.target.checked;
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

        this.playButton.addEventListener("click",function(e) {
            if (this.playing) {
                this.pauseScheduler();
            }
            else {
                this.startScheduler();
            }
        }.bind(this));

        this.stopButton.addEventListener("click",function(e) {
            this.stopScheduler();
        }.bind(this));

        this.refreshNoteLegend = function (st, oct, bar_num) {
            // note name
            var name;
            if (st === -1 || isNaN(oct)) {
                name = "--";
            }
            else {
                var midi_note = (oct + 1) * 12 + st;
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
        };

        if (args.initialState && args.initialState.data) {
            /* Load data */
            this.lisaStatus = args.initialState.data;
            /* Backwards compatibility */
            if (typeof this.lisaStatus.matrix[0]["ctrl1"] === 'undefined') {
                for (var i = 0; i < 32; i+=1 ) {
                    this.lisaStatus.matrix[i]["ctrl1"] = {type: 52, values: [0,0,0,0,0,0,0,0]},
                    this.lisaStatus.matrix[i]["ctrl2"] = {type: 53, values: [0,0,0,0,0,0,0,0]},
                    this.lisaStatus.matrix[i]["ctrl3"] = {type: 54, values: [0,0,0,0,0,0,0,0]},
                    this.lisaStatus.matrix[i]["ctrl4"] = {type: 55, values: [0,0,0,0,0,0,0,0]}
                }
            }
        }
        else {
            this.lisaStatus = {
                matrix: [],
                page: 'pitch',
                numPatterns: 4,
                currPattern: 0,
                tempo: 60,
                checked: false
            };

            for (var i = 0; i < 32; i+=1 ) {
                this.lisaStatus.matrix.push ({
                    pitch: {
                        semitone: [-1,-1,-1,-1,-1,-1,-1,-1],
                        octave: [4,4,4,4,4,4,4,4]
                    },
                    velocity: [0.75,0.75,0.75,0.75,0.75,0.75,0.75,0.75],
                    channel: [0.0625,0.0625,0.0625,0.0625,0.0625,0.0625,0.0625,0.0625],
                    "ctrl1": {type: 52, values: [0,0,0,0,0,0,0,0]},
                    "ctrl2": {type: 53, values: [0,0,0,0,0,0,0,0]},
                    "ctrl3": {type: 54, values: [0,0,0,0,0,0,0,0]},
                    "ctrl4": {type: 55, values: [0,0,0,0,0,0,0,0]}
                });
            }
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
                        var st = normal_value === 0 ? -1 : (normal_value * 12 - 1);
                        console.log ("Setting note ", st);

                        this.lisaStatus.matrix[this.lisaStatus.currPattern].pitch.semitone[bar_num] = st;
                        var oct = this.lisaStatus.matrix[this.lisaStatus.currPattern].pitch.octave[bar_num];

                        this.refreshNoteLegend (st, oct, bar_num);
                    }
                }
                else if (this.lisaStatus.page === 'velocity') {
                    var vel = Math.round (value * 127);
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
                else if (this.lisaStatus.page.indexOf("ctrl") === 0) {
                    var ctrln = this.lisaStatus.page;
                    // 128 here because 0 is "don't send"
                    var val = Math.round (value * 128);
                    this.lisaStatus.matrix[this.lisaStatus.currPattern][ctrln]["values"][bar_num] = value;
                    this.stepLegendList[bar_num].innerHTML = val - 1;
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
        this.setRedrawPattern("0", true);
        this.setTotalPatterns();
        this.setTempo();
        this.setLoop();

        args.hostInterface.setDestructor (function () {
            this.stopScheduler();
        }.bind(this));

        var saveState = function () {
            return { data: this.lisaStatus };
        };
        args.hostInterface.setSaveState (saveState.bind(this));

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
