///<amd-module name='main'/>

import * as playbackControl from "./playbackControl";
import * as volumeControl from "./volumeControl";
import * as filterControl from "./filterControl";
import * as chartControl from "./chartControl";
    
const { waveformControl, frequencyControl } = chartControl.setup();

playbackControl.setup([waveformControl.chart, frequencyControl.chart]);

volumeControl.setup();

filterControl.setup(
    /*onActivate*/() => {
        // add original data charts
        waveformControl.chart.link(waveformControl.chartWithNoFilters);
        frequencyControl.chart.link(frequencyControl.chartWithNoFilters);

        // re-setup regular chart options
        waveformControl.chart.setOptions({ clearCanvas: false });
        frequencyControl.chart.setOptions({ drawLabels: false, clearCanvas: false });
    },
    /*onDeactivate*/() => {
        // remove original data charts
        waveformControl.chart.unlink(waveformControl.chartWithNoFilters);
        frequencyControl.chart.unlink(frequencyControl.chartWithNoFilters);

        // re-setup regular chart options
        waveformControl.chart.setOptions({ clearCanvas: true });
        frequencyControl.chart.setOptions({ drawLabels: true, clearCanvas: true });
    }
);
