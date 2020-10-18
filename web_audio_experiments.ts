"use strict";

const audioContext = new AudioContext();

const audioElem = document.querySelector('audio') as HTMLAudioElement;
const track = audioContext.createMediaElementSource(audioElem);

const playButton = document.getElementById('playBtn') as HTMLButtonElement;

const gainNodeL = audioContext.createGain();
const gainNodeR = audioContext.createGain();
const volumeControlL = document.getElementById('volumeL') as HTMLInputElement;
const volumeControlR = document.getElementById('volumeR') as HTMLInputElement;

gainNodeL.gain.value = parseInt(volumeControlL.value);
volumeControlL.addEventListener('input', function() {
    gainNodeL.gain.value = parseFloat(this.value);
}, false);

gainNodeR.gain.value = parseInt(volumeControlR.value);
volumeControlR.addEventListener('input', function() {
    gainNodeR.gain.value = parseFloat(this.value);
}, false);

const pannerNode = new StereoPannerNode(audioContext, { pan: 0 });
const pannerControl = document.getElementById('panner') as HTMLInputElement;

pannerControl.addEventListener('input', function() {
    pannerNode.pan.value = parseFloat(this.value);
}, false);

const splitNode = audioContext.createChannelSplitter(2);
const mergeLRNode = audioContext.createChannelMerger(2);
const analyserNode = audioContext.createAnalyser();

const filterTypeElem = document.getElementById('filterType') as HTMLSelectElement;
const filterFrequencyElem = document.getElementById('filterFrequency') as HTMLInputElement;
const filterDetuneElem = document.getElementById('filterDetune') as HTMLInputElement;
const filterQualityElem = document.getElementById('filterQuality') as HTMLInputElement;
const filterGainElem = document.getElementById('filterGain') as HTMLInputElement;

const frequencyFilterNode = audioContext.createBiquadFilter();
const originalAnalyserNode = audioContext.createAnalyser();
track.connect(originalAnalyserNode);

filterFrequencyElem.addEventListener('input', function() {
	frequencyFilterNode.frequency.value = parseInt(this.value);
});

filterDetuneElem.addEventListener('input', function() {
	frequencyFilterNode.detune.value = parseInt(this.value);
});

filterQualityElem.addEventListener('input', function() {
	frequencyFilterNode.Q.value = parseInt(this.value);
});

filterGainElem.addEventListener('input', function() {
	frequencyFilterNode.gain.value = parseInt(this.value);
});

track.connect(splitNode);

splitNode
	.connect(gainNodeL, /*L*/0)
	.connect(mergeLRNode, 0, /*L*/0);
	
splitNode
	.connect(gainNodeR, /*R*/1)
	.connect(mergeLRNode, 0, /*R*/1);
	
mergeLRNode
	.connect(pannerNode)
	.connect(audioContext.destination);
	
const fftSizeElem = document.getElementById('fftSize') as HTMLInputElement;
analyserNode.fftSize = parseInt(fftSizeElem.value);
originalAnalyserNode.fftSize = analyserNode.fftSize;

// SPN = Scientific Pitch Notation
const spnToSolfegeNotation: { [noteName: string]: string } = {
	'C': 'Do',
	'D': 'Re',
	'E': 'Mi',
	'F': 'Fa',
	'G': 'Sol',
	'A': 'La',
	'B': 'Si'
};

const translateToSolfegeNotation = (spnNoteName: string) => {
	return spnToSolfegeNotation[spnNoteName[0]] + spnNoteName.substring(1);
};

const numberToSubscript = (number: number) => {
	const numberText = number.toString();
	var result = "";
	for (var i = 0; i < numberText.length; i++) {
		const digitCharCode = numberText.charCodeAt(i);
		result += String.fromCharCode(digitCharCode + 8272);
	}
	return result;
}

const checkIfTextFits = (ctx: CanvasRenderingContext2D, text: string, maxAllowedWidth: number) => {
	const textWidth = ctx.measureText(text).width;
	return textWidth <= maxAllowedWidth;
};

const fillTextIfFits = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxAllowedWidth: number) => {
	if (checkIfTextFits(ctx, text, maxAllowedWidth)) {
		ctx.fillText(text, x, y);
	}
};

const maxDrawSamplesElem = document.getElementById('maxDrawSamples') as HTMLInputElement;
const maxDrawLinesElem = document.getElementById('maxDrawLines') as HTMLInputElement;

const waveformCanvasElem = document.getElementById('waveformCanvas') as HTMLCanvasElement;

const WaveformChart = function (canvasElem: HTMLCanvasElement, analyserNode: AnalyserNode) {
	var animationHandle: number;
	return {
		width: canvasElem.width,
		height: canvasElem.height,
		canvasCtx: canvasElem.getContext('2d'),
		data: undefined as Uint8Array,
		maxDrawSpanY: undefined as number,
		maxDrawSpanX: undefined as number,
		drawSpanX: undefined as number,
		drawSpanY: undefined as number,
		y: undefined as number,
		options: {
			clearCanvas: true
		},
		isActive: false,
		start: function() {
			this.reset();
			this.isActive = true;
			this.draw();
		},
		stop: function() {
			this.isActive = false;
			if (animationHandle) {
				window.cancelAnimationFrame(animationHandle);
				animationHandle = null;
			}
		},
		reset: function() {
			this.data = new Uint8Array(analyserNode.frequencyBinCount);
			this.maxDrawSpanY = parseInt(maxDrawLinesElem.value);
			this.maxDrawSpanX = parseInt(maxDrawSamplesElem.value) / this.maxDrawSpanY,
			this.drawSpanX = 0;
			this.drawSpanY = 0;
			this.y = 0;
		},
		lineStrokeStyle: function() {
			return 'rgb(' + (255 * this.drawSpanX / this.maxDrawSpanX) + ', 0, ' + (255 * this.drawSpanY / this.maxDrawSpanY) + ')';
		},
		draw: function() {
			if (this.isActive) {
				animationHandle = window.requestAnimationFrame(this.draw.bind(this));
			}
			
			analyserNode.getByteTimeDomainData(this.data);

			if (this.options.clearCanvas && this.drawSpanX == 0 && this.drawSpanY == 0) {
				this.canvasCtx.fillStyle = 'rgb(200, 200, 200)';
				this.canvasCtx.fillRect(0, 0, this.width, this.height);
			}
			
			this.canvasCtx.lineWidth = 1;
			this.canvasCtx.strokeStyle = this.lineStrokeStyle();
			this.canvasCtx.beginPath();
			
			const sliceWidth = (this.width / this.maxDrawSpanX) * 1.0 / this.data.length;
			var x = this.drawSpanX * this.width / this.maxDrawSpanX;
			
			if (this.drawSpanX > 0) {
				this.canvasCtx.moveTo(x - sliceWidth, this.y);
			}
			
			for(var i = 0; i < this.data.length; i++) {
		
				const v = this.data[i] / 128.0;
				this.y = (this.drawSpanY * this.height/ this.maxDrawSpanY) + v * (this.height / this.maxDrawSpanY) / 2;

				if (i === 0 && this.drawSpanX == 0) {
					this.canvasCtx.moveTo(x, this.y);
				} else {
					this.canvasCtx.lineTo(x, this.y);
				}

				x += sliceWidth;
			}
			
			this.canvasCtx.stroke();

			this.drawSpanX++;
			if (this.drawSpanX >= this.maxDrawSpanX) {
				this.drawSpanX = 0;
				this.drawSpanY++;
				if (this.drawSpanY >= this.maxDrawSpanY) {
					this.drawSpanY = 0;
				}
			}
		}
	};
};


type MouseEventHandler = (evt: MouseEvent) => any;

const frequencyCanvasElem = document.getElementById('frequencyBarCanvas');

const FrequencyBarChart = function (canvasElem: HTMLCanvasElement, analyserNode: AnalyserNode) {
	var animationHandle: number;
	var mouseMoveHandler: MouseEventHandler,
		mouseUpHandler: MouseEventHandler,
		mouseDownHandler: MouseEventHandler;
	return {
		scaleX: 1,
		startX: undefined as number,
		canvasCtx: canvasElem.getContext('2d'),
		width: undefined as number,
		height: undefined as number,
		data: undefined as Uint8Array,
		barUnitWidth: undefined as number,
		barUnitSpacingWidth: undefined as number,
		options: {
			drawLabels: true,
			drawChromaticScale: false,
			useSolfegeNotation: false,
			clearCanvas: true,
			logScale: false
		},
		isActive: false,
		start: function() {
			this.reset();
			this.isActive = true;
			this.draw();

			var isDragging = false;

			canvasElem.addEventListener('mousedown', mouseDownHandler = () => {
				isDragging = true;
			});
			
			canvasElem.addEventListener('mousemove', mouseMoveHandler = (evt: MouseEvent) => {
				if (isDragging) {
					this.startX = Math.min(0, this.startX + evt.movementX);
				}
			});

			canvasElem.addEventListener('mouseup', mouseUpHandler = () => {
				isDragging = false;
			});
		},
		stop: function() {
			this.isActive = false;
			if (animationHandle) {
				window.cancelAnimationFrame(animationHandle);
				animationHandle = null;
			}

			canvasElem.removeEventListener('mousemove', mouseMoveHandler);
			canvasElem.removeEventListener('mouseup', mouseUpHandler);
			canvasElem.removeEventListener('mousedown', mouseDownHandler);
		},
		reset: function() {
			this.data = new Uint8Array(analyserNode.frequencyBinCount);
			this.width = canvasElem.width / this.scaleX;
			this.height = canvasElem.height;

			this.startX = 0;

			const spacingTotalWidth = this.width / 10;
			this.barUnitWidth = (this.width - spacingTotalWidth) / this.data.length;
			this.barUnitSpacingWidth = spacingTotalWidth / (this.data.length - 1);
		},
		barFillStyle: function (barIdx: number) {
			return 'rgb(' + (this.data[barIdx] / 2 + 150) + ', 0, 0)';
		},
		draw: function() {
			if (this.isActive) {
				animationHandle = window.requestAnimationFrame(this.draw.bind(this));
			}
			
			analyserNode.getByteFrequencyData(this.data);

			if (this.options.clearCanvas) {
				this.canvasCtx.fillStyle = 'black';
				this.canvasCtx.fillRect(0, 0, canvasElem.width, canvasElem.height);
			}

			const chromaticScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

			if (this.options.drawChromaticScale && this.options.logScale) {
				const noteWidth = this.barUnitWidth + this.barUnitSpacingWidth;
				const noteSectionWidth = chromaticScale.length * noteWidth;
				const labelMargin = 5;
				const maxNoteTextWidth = noteWidth - 2;

				var octavePos = 0;
				var frequency = 16.35; // start in C_0 note frequency, which is 16.35 Hz
				var x = this.startX + Math.log2(frequency) * noteSectionWidth - noteWidth / 2;
				var evenIteration = true;

				while (x < canvasElem.width) {
					// fill section background in a even/odd pattern
					this.canvasCtx.fillStyle = evenIteration ? '#222222' : 'black';
					this.canvasCtx.fillRect(x, 0, noteSectionWidth, canvasElem.height);
					
					// divide the section in sub-sections for each note (if readable at all)
					const octaveText = numberToSubscript(octavePos);
					const sampleNote = 'C' + octaveText;
					if (checkIfTextFits(this.canvasCtx, sampleNote, maxNoteTextWidth)) {
						chromaticScale.forEach((note, idx) => {
							const noteX = x + idx * noteWidth;
							const noteMaxX = noteX + noteWidth - 1;
							const startY = 30;

							this.canvasCtx.strokeStyle = 'gray';
							this.canvasCtx.beginPath();
							this.canvasCtx.moveTo(noteMaxX, startY);
							this.canvasCtx.lineTo(noteMaxX, canvasElem.height);
							this.canvasCtx.stroke();
							
							const noteName = this.options.useSolfegeNotation ? translateToSolfegeNotation(note) : note;
							this.canvasCtx.fillStyle = 'gray';
							this.canvasCtx.textAlign = 'center';
							fillTextIfFits(this.canvasCtx, noteName + octaveText, noteX + noteWidth / 2 - 1, startY, maxNoteTextWidth);
						});
					}

					// draw frequency label on top of the section
					if (this.options.drawLabels) {
						this.canvasCtx.fillStyle = 'white';
						this.canvasCtx.textAlign = 'left';
						this.canvasCtx.textBaseline = 'top';
						fillTextIfFits(this.canvasCtx, frequency + ' Hz', x + labelMargin, labelMargin, noteSectionWidth - labelMargin * 2);
					}

					x += noteSectionWidth;
					frequency *= 2;
					octavePos++;
					evenIteration = !evenIteration;
				}
			}
			
			const maxFrequency = analyserNode.context.sampleRate / 2;
			var x = this.startX as number;
			var prevFrequency = 1;
			var accData = new Array();
			var lastLabelEndX: number;

			for (var i = 0; i < this.data.length; i++) {
				accData.push(this.data[i]);

				const frequency = maxFrequency * (i + 1) / this.data.length;
				var barWidth: number, barSpacingWidth: number;

				if (this.options.logScale) {
					const exponentScalingFactor = chromaticScale.length * (Math.log2(frequency) - Math.log2(prevFrequency));
					barWidth = this.barUnitWidth * exponentScalingFactor;
					barSpacingWidth = this.barUnitSpacingWidth * exponentScalingFactor;
				} else {
					barWidth = this.barUnitWidth * accData.length;
					barSpacingWidth = this.barUnitSpacingWidth;
				}

				if (x >= canvasElem.width) {
					// no longer visible inside canvas, no use in drawing
					break;
				}

				// draw the bar if the accumulated width is meaningful
				// otherwise just accumulate and perform the average later
				// (better performance and also less cluttered visual)		
				if (barWidth < 0.5) {
					continue;
				}
				
				const avgAccData = accData.reduce((sum, v) => sum + v) / accData.length;
				const barHeight = avgAccData / 2;
				const y = this.height - barHeight;

				this.canvasCtx.fillStyle = this.barFillStyle(i);
				this.canvasCtx.fillRect(x, y, barWidth, barHeight);
				
				if (this.options.drawLabels) {
					const label = Math.round(frequency) + 'Hz';
					const labelWidth = this.canvasCtx.measureText(label).width;
					const labelCenterX = x + barWidth / 2;
					const labelStartX = labelCenterX - labelWidth / 2;

					if (lastLabelEndX === undefined || labelStartX - lastLabelEndX >= 20) {
						lastLabelEndX = labelStartX + labelWidth;

						this.canvasCtx.fillStyle = 'white';
						this.canvasCtx.textAlign = 'center';
						this.canvasCtx.fillText(label, labelCenterX, y - 20);

					}
				}
				
				x += barWidth + barSpacingWidth;
				prevFrequency = frequency;
				accData = new Array();
			}
		}
	};
};

const waveformChart = new (WaveformChart as any)(waveformCanvasElem, analyserNode);

const originalWaveformChart = new (WaveformChart as any)(waveformCanvasElem, originalAnalyserNode);
originalWaveformChart.lineStrokeStyle = function () { return 'darkgreen'; };

const frequencyBarChart = new (FrequencyBarChart as any)(frequencyCanvasElem, analyserNode);

const originalFreqBarChart = new (FrequencyBarChart as any)(frequencyCanvasElem, originalAnalyserNode);
originalFreqBarChart.barFillStyle = function (barIdx: number) { return 'gray'; };

const charts = [waveformChart, frequencyBarChart];

maxDrawSamplesElem.addEventListener('input', function() {
	charts.forEach(chart => chart.reset());
});

maxDrawLinesElem.addEventListener('input', function() {
	charts.forEach(chart => chart.reset());
});

fftSizeElem.addEventListener('change', function() {
	var currFFTSize = parseInt(this.value);
	const logBase2 = Math.log2(currFFTSize);
	
	if (analyserNode.fftSize < currFFTSize) {
		analyserNode.fftSize = Math.pow(2, Math.ceil(logBase2));
	} else {
		analyserNode.fftSize = Math.pow(2, Math.floor(logBase2));
	}
	originalAnalyserNode.fftSize = analyserNode.fftSize;
	
	charts.forEach(chart => chart.reset());

	this.value = analyserNode.fftSize.toString();
});

const onAudioStopped = () => {
	playButton.dataset.playing = 'false';
	playButton.innerHTML = 'Play';

	charts.forEach(chart => chart.stop());
		
	pannerNode.disconnect(analyserNode);
};

audioElem.addEventListener('error', (evt) => { console.log(evt); });

playButton.addEventListener('click', function () {
	if (audioContext.state == 'suspended') {
		audioContext.resume();
	}
	
	if (this.dataset.playing === 'false') {
		audioElem.play();
		this.dataset.playing = 'true';
		
		pannerNode.connect(analyserNode);
		
		charts.forEach(chart => chart.start());
		
		playButton.innerHTML = 'Pause';
	} else if (this.dataset.playing === 'true') {
		audioElem.pause();
		onAudioStopped();
	}
}, false);


audioElem.addEventListener('ended', onAudioStopped);

const freqChartScaleElems = document.getElementsByName('freqChartScale') as NodeListOf<HTMLInputElement>;
for (const elem of freqChartScaleElems) {
	elem.addEventListener('input', function () {
		if (this.checked) {
			const useLogScale = this.value === 'log';

			frequencyBarChart.options.logScale = useLogScale;
			frequencyBarChart.options.drawChromaticScale = useLogScale;
			frequencyBarChart.scaleX = useLogScale ? Math.pow(2, -7) : 1; // useful default

			originalFreqBarChart.options.logScale = useLogScale;
			originalFreqBarChart.scaleX = frequencyBarChart.scaleX;
		}
	});
	elem.dispatchEvent(new Event('input'));
}

const audioFileElem = <HTMLInputElement> document.getElementById('audioFile');
audioFileElem.addEventListener('change', function() {
	const file = URL.createObjectURL(this.files[0]);
	audioElem.src = file;
	
	if (playButton.dataset.playing === 'true') {
		audioElem.play();
	}
});

const recordBtn = document.getElementById('recordBtn');
var recordingStream = null;
var recordingSource: MediaStreamAudioSourceNode = null;

recordBtn.addEventListener('click', function() {
	if (recordingSource) {
		recordingSource.mediaStream.getAudioTracks().forEach(function (track) { track.stop(); });
		recordingSource.disconnect(analyserNode);
		recordingSource = null;
		
		charts.forEach(chart => chart.stop());

		recordBtn.innerHTML = 'Record';
	} else {
		navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
			recordingSource = audioContext.createMediaStreamSource(stream);
			recordingSource.connect(analyserNode);
			
			if (audioContext.state == 'suspended') {
				audioContext.resume();
			}
			
			charts.forEach(chart => chart.start());
			
			recordBtn.innerHTML = 'Recording...';
		});
	}
});

const zoomInElem = document.getElementById('zoomInBtn');
zoomInElem.addEventListener('click', function () {
	frequencyBarChart.scaleX /= 2;
	frequencyBarChart.reset();

	originalFreqBarChart.scaleX = frequencyBarChart.scaleX;
	originalFreqBarChart.reset();
});

const zoomOutElem = document.getElementById('zoomOutBtn');
zoomOutElem.addEventListener('click', function () {
	frequencyBarChart.scaleX *= 2;
	frequencyBarChart.reset();

	originalFreqBarChart.scaleX = frequencyBarChart.scaleX;
	originalFreqBarChart.reset();
});

const zoomResetElem = document.getElementById('zoomResetBtn');
zoomResetElem.addEventListener('click', function () {
	frequencyBarChart.scaleX = 1;
	frequencyBarChart.reset();

	originalFreqBarChart.scaleX = 1;
	originalFreqBarChart.reset();
});

filterTypeElem.addEventListener('change', function() {
	if (filterTypeElem.value === '' && this.dataset.filtering == 'true') {
		track.disconnect(frequencyFilterNode);
		frequencyFilterNode.disconnect(splitNode);
		track.connect(splitNode);

		filterFrequencyElem.parentElement.classList.add('hidden');
		filterDetuneElem.parentElement.classList.add('hidden');
		filterQualityElem.parentElement.classList.add('hidden');
		filterGainElem.parentElement.classList.add('hidden');

		// remove original data charts
		charts.splice(0, /*deleteCount*/2).forEach(chart => chart.stop());

		// re-setup regular chart options
		waveformChart.options.clearCanvas = true;
		frequencyBarChart.options.drawLabels = true;
		frequencyBarChart.options.clearCanvas = true;
		
		this.dataset.filtering = false.toString();
	} else {
		frequencyFilterNode.type = filterTypeElem.value as BiquadFilterType;

		if (this.dataset.filtering == 'false') {
			filterFrequencyElem.value = frequencyFilterNode.frequency.value.toString();
			filterDetuneElem.value = frequencyFilterNode.detune.value.toString();
			filterQualityElem.value = frequencyFilterNode.Q.value.toString();
			filterGainElem.value = frequencyFilterNode.gain.value.toString();	

			track.disconnect(splitNode);
			track.connect(frequencyFilterNode).connect(splitNode);

			filterFrequencyElem.parentElement.classList.remove('hidden');
			filterDetuneElem.parentElement.classList.remove('hidden');

			var chartsWereActive = charts.some(c => c.isActive);
			
			// add original data charts
			// regular charts need to be reset as well, so both are in sync in terms of drawing
			charts.forEach(chart => chart.stop());
			charts.unshift(originalWaveformChart, originalFreqBarChart);

			// re-setup regular chart options
			waveformChart.options.clearCanvas = false;
			frequencyBarChart.options.drawLabels = false;
			frequencyBarChart.options.clearCanvas = false;

			if (chartsWereActive) {
				charts.forEach(chart => chart.start());
			}
			
			this.dataset.filtering = true.toString();
		}

		if (['lowshelf', 'highshelf'].indexOf(filterTypeElem.value) >= 0) {
			filterQualityElem.parentElement.classList.add('hidden');
		} else {
			filterQualityElem.parentElement.classList.remove('hidden');
		}

		if (['lowshelf', 'highshelf', 'peaking'].indexOf(filterTypeElem.value) >= 0) {
			filterGainElem.parentElement.classList.remove('hidden');
		} else {
			filterGainElem.parentElement.classList.add('hidden');
		}
	} 
});