define(['require', 'github:janesconference/nu.js/nu','./lisa.html!text', './lisa.css!text'], function(require, Note, htmlTemp, cssTemp) {

    var pluginConf = {
        name: "Lisa",
        osc: false,
        version: '0.0.1-alpha1',
        ui: {
            type: 'div',
            width: 400,
            height: 190,
            html: htmlTemp,
            css: cssTemp
        }
    };

    var pluginFunction = function(args) {

        this.name = args.name;
        this.id = args.id;
        this.context = args.audioContext;

        this.note = new Note({frequency:440});

        this.midiHandler = args.MIDIHandler;

        this.status = {

        };

        this.playing = false;

        var domEl = args.div;
        var delegateEl = domEl.getElementsByClassName("controls")[0];

        var inputs = domEl.getElementsByTagName("input");
        var noteInputs = Array.prototype.slice.call(inputs,0,8);
        var chInputs = Array.prototype.slice.call(inputs,8,16);
        var velInputs = Array.prototype.slice.call(inputs,16,24);
        var tempo = inputs[24];

        this.tolerance = 200; // ms
        this.steps = 8; // TODO this will be variable

        this.schedulerCursor = 0; // current playing position

        this.incrementScheduleCursor = function (){
            this.schedulerCursor = (this.schedulerCursor + 1) % this.steps;
        };

        this.resetScheduleCursor = function () {
            this.schedulerCursor = 0;
        };

        this.play = function (startTime, interval) {

            // Send a deferred MIDI, starting in: tolerance (delay) in seconds + start time + interval in seconds * step
            var when = this.tolerance / 1000 + startTime + (interval * this.schedulerCursor) / 1000;

            // Read the message description from the status
            var note = this.status.notes[this.schedulerCursor];
            var vel = this.status.velocities[this.schedulerCursor];
            var ch = this.status.channels[this.schedulerCursor];

            // Build the message
            var msg = {/*TODO note, vel, ch*/};

            this.midiHandler.sendMIDIMessage (msg, when);

            // TODO probably we need to send a midi off when the note ends.
            // Here we need to decide if continue the note until a new one starts
            // Or to kill the note at the start of the new step (aka we need a switch)

            this.incrementScheduleCursor();

        }.bind(this);

        this.startScheduler = function () {
            this.playing = true;
            var interval = this.status.tempo / 60 * 1000; // Beat interval in ms
            var timeNow = this.context.currentTime;
            this.schedulerInterval = setInterval(this.play, interval, [timeNow, interval]);
        };

        this.stopScheduler = function () {
            this.pauseScheduler();
            this.resetScheduleCursor();
        };

        this.pauseScheduler = function () {
            this.playing = false;
            clearInterval(this.schedulerInterval);
        };

        // TODO react to input change (blur and enter)

        delegateEl.addEventListener("click",function(e) {
            if(e.target) {
                var elId = e.target.id.split('-')[1];
                switch (elId) {
                    case 'play':
                        if (this.playing) {
                            return;
                        }
                        console.log ("Play");

                        // Reset status
                        status.notes = [];
                        status.channels = [];
                        status.velocities = [];

                        // Populate status, parsing fields.
                        for (var i = 0; i < 8; i += 1) {

                            status.notes[i] = parseInt(noteInputs[i].value, 10);
                            console.log ("note " + i + ": " + status.notes[i]);

                            status.channels[i] = parseInt(chInputs[i].value, 10);
                            console.log ("channel " + i + ": " + status.channels[i]);

                            status.velocities[i] = parseInt(velInputs[i].value, 10);
                            console.log ("vel " + i + ": " + status.velocities[i]);

                        }

                        this.status.tempo = parseInt(tempo.value, 10);
                        if (isNaN(tempo)) {
                            this.status.tempo = 60; // Default tempo is 60 bpm
                        }
                        console.log ("tempo: " + this.status.tempo);

                        this.startScheduler();
                        break;
                    case 'stop':
                        if (!this.playing) {
                            this.resetScheduleCursor();
                            return;
                        }
                        console.log ("Stop");
                        this.stopScheduler();
                        break;
                    case 'pause':
                        if (!this.playing) {
                            return;
                        }
                        console.log ("Pause");
                        this.pauseScheduler();
                        break;
                }
            }
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
