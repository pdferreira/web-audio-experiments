///<amd-module name='filterControl'/>

import * as audioGraph from "./audioGraph";

const filterTypeElem = document.getElementById('filterType') as HTMLSelectElement;
const filterFrequencyElem = document.getElementById('filterFrequency') as HTMLInputElement;
const filterDetuneElem = document.getElementById('filterDetune') as HTMLInputElement;
const filterQualityElem = document.getElementById('filterQuality') as HTMLInputElement;
const filterGainElem = document.getElementById('filterGain') as HTMLInputElement;

const frequencyFilterNode = audioGraph.frequencyFilterNode;

export function setup(onActivate: () => void, onDeactivate: () => void) {
	audioGraph.bindAudioParamToInput(frequencyFilterNode.frequency, filterFrequencyElem);
	audioGraph.bindAudioParamToInput(frequencyFilterNode.detune, filterDetuneElem);
	audioGraph.bindAudioParamToInput(frequencyFilterNode.Q, filterQualityElem);
	audioGraph.bindAudioParamToInput(frequencyFilterNode.gain, filterGainElem);

	filterTypeElem.addEventListener('change', function () {
		if (filterTypeElem.value === '' && this.dataset.filtering == 'true') {
			audioGraph.deactivateFilter();

			filterFrequencyElem.parentElement!.classList.add('hidden');
			filterDetuneElem.parentElement!.classList.add('hidden');
			filterQualityElem.parentElement!.classList.add('hidden');
			filterGainElem.parentElement!.classList.add('hidden');

			onDeactivate();
			this.dataset.filtering = false.toString();
		} else {
			audioGraph.frequencyFilterNode.type = filterTypeElem.value as BiquadFilterType;

			if (this.dataset.filtering == 'false') {
				filterFrequencyElem.value = audioGraph.frequencyFilterNode.frequency.value.toString();
				filterDetuneElem.value = audioGraph.frequencyFilterNode.detune.value.toString();
				filterQualityElem.value = audioGraph.frequencyFilterNode.Q.value.toString();
				filterGainElem.value = audioGraph.frequencyFilterNode.gain.value.toString();

				audioGraph.activateFilter();

				filterFrequencyElem.parentElement!.classList.remove('hidden');
				filterDetuneElem.parentElement!.classList.remove('hidden');

				onActivate();
				this.dataset.filtering = true.toString();
			}

			if (['lowshelf', 'highshelf'].indexOf(filterTypeElem.value) >= 0) {
				filterQualityElem.parentElement!.classList.add('hidden');
			} else {
				filterQualityElem.parentElement!.classList.remove('hidden');
			}

			if (['lowshelf', 'highshelf', 'peaking'].indexOf(filterTypeElem.value) >= 0) {
				filterGainElem.parentElement!.classList.remove('hidden');
			} else {
				filterGainElem.parentElement!.classList.add('hidden');
			}
		}
	});
}