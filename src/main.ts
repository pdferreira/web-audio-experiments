///<amd-module name='main'/>

import * as audioGraph from "./audioGraph";
import * as filterControl from "./filterControl";
import * as playbackControl from "./playbackControl";
import * as chartControl from "./chartControl";

function bindAudioParamToInputById(param: AudioParam, inputId: string) {
	const input = document.getElementById(inputId) as HTMLInputElement;
	audioGraph.bindAudioParamToInput(param, input);
}

bindAudioParamToInputById(audioGraph.gainNodeL.gain, 'volumeL');
bindAudioParamToInputById(audioGraph.gainNodeR.gain, 'volumeR');
bindAudioParamToInputById(audioGraph.pannerNode.pan, 'panner');
	
const { waveformControl, frequencyControl } = chartControl.setup();

playbackControl.setup([waveformControl.chart, frequencyControl.chart]);

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
