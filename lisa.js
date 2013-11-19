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

        this.status = {

        };

        var domEl = args.div;
        var delegateEl = domEl.getElementsByClassName("controls")[0];

        var inputs = domEl.getElementsByTagName("input");
        var noteInputs = Array.prototype.slice.call(inputs,0,8);
        var chInputs = Array.prototype.slice.call(inputs,8,16);
        var velInputs = Array.prototype.slice.call(inputs,16,24);
        var tempo = inputs[24];


        delegateEl.addEventListener("click",function(e) {
            if(e.target) {
                var elId = e.target.id.split('-')[1];
                switch (elId) {
                    case 'play':
                        console.log ("Play");
                        for (var i=0; i < 8; i+=1) {
                            console.log ("note " + i + ": " + noteInputs[i].value);
                            console.log ("channel " + i + ": " + chInputs[i].value);
                            console.log ("vel " + i + ": " + velInputs[i].value);
                        }
                        console.log ("tempo: " + tempo.value);
                        break;
                    case 'stop':
                        console.log ("Stop");
                        break;
                    case 'pause':
                        console.log ("Pause");
                        break;
                }
            }
        });

        //args.MIDIHandler.sendMIDIMessage (msg, when);

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
