"use strict";

const audioContext = new AudioContext();

const audioElem = document.querySelector('audio') as HTMLAudioElement;
const track = audioContext.createMediaElementSource(audioElem);

const playButton = document.getElementById('playBtn') as HTMLButtonElement;

const gainNodeL = audioContext.createGain();
const gainNodeR = audioContext.createGain();
const volumeControlL = document.getElementById('volumeL') as HTMLInputElement;
const volumeControlR = document.getElementById('volumeR') as HTMLInputElement;

gainNodeL.gain.value = parseFloat(volumeControlL.value);
volumeControlL.addEventListener('input', function() {
    gainNodeL.gain.value = parseFloat(this.value);
}, false);

gainNodeR.gain.value = parseFloat(volumeControlR.value);
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

interface IAnimatedChart {
	readonly isActive: boolean;
	start(): void;
	stop(): void;
	reset(): void;
}

abstract class AbstractAnimatedChart implements IAnimatedChart {

	private animationHandle: number;
	
	protected data: Uint8Array;
	protected readonly analyserNode: AnalyserNode
	
	public isActive: boolean;

	constructor (analyserNode: AnalyserNode) {
		this.analyserNode = analyserNode;
		this.isActive = false;
	}

	public abstract reset(): void;

	protected abstract draw(): void;

	private animate(): void {
		if (this.isActive) {
			this.animationHandle = window.requestAnimationFrame(this.animate.bind(this));
		}

		this.draw();
	}

	public start() {
		this.reset();
		this.isActive = true;
		this.animate();
	}

	public stop() {
		this.isActive = false;
		if (this.animationHandle) {
			window.cancelAnimationFrame(this.animationHandle);
			this.animationHandle = null;
		}
	}

}

interface IWaveformChartOptions {
	clearCanvas: boolean;
	lineStrokeStyle(): string;
}

class WaveformChart extends AbstractAnimatedChart {

	private readonly width: number;
	private readonly height: number;
	private readonly canvasCtx: CanvasRenderingContext2D;
	public readonly options: IWaveformChartOptions;
	
	private maxDrawSpanY: number;
	private maxDrawSpanX: number;
	private drawSpanX: number;
	private drawSpanY: number;
	private y: number;

	constructor (canvasElem: HTMLCanvasElement, analyserNode: AnalyserNode) {
		super(analyserNode);
		this.width = canvasElem.width;
		this.height = canvasElem.height;
		this.canvasCtx = canvasElem.getContext('2d');
		this.options = {
			clearCanvas: true,
			lineStrokeStyle: this.defaultLineStrokeStyle.bind(this)
		};
	}

	public reset() {
		this.data = new Uint8Array(this.analyserNode.frequencyBinCount);
		this.maxDrawSpanY = parseInt(maxDrawLinesElem.value);
		this.maxDrawSpanX = parseInt(maxDrawSamplesElem.value) / this.maxDrawSpanY,
		this.drawSpanX = 0;
		this.drawSpanY = 0;
		this.y = 0;
	}

	private defaultLineStrokeStyle() {
		return 'rgb(' + (255 * this.drawSpanX / this.maxDrawSpanX) + ', 0, ' + (255 * this.drawSpanY / this.maxDrawSpanY) + ')';
	}

	protected draw() {
		this.analyserNode.getByteTimeDomainData(this.data);

		if (this.options.clearCanvas && this.drawSpanX == 0 && this.drawSpanY == 0) {
			this.canvasCtx.fillStyle = 'rgb(200, 200, 200)';
			this.canvasCtx.fillRect(0, 0, this.width, this.height);
		}
		
		this.canvasCtx.lineWidth = 1;
		this.canvasCtx.strokeStyle = this.options.lineStrokeStyle();
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

}


type MouseEventHandler = (evt: MouseEvent) => any;

const frequencyCanvasElem = document.getElementById('frequencyBarCanvas') as HTMLCanvasElement;

interface IFrequencyBarChartOptions {
	drawLabels: boolean;
	drawChromaticScale: boolean;
	useSolfegeNotation: boolean;
	clearCanvas: boolean;
	logScale: boolean;
	scaleX: number;
	barFillStyle(idx: number): string;
}

class FrequencyBarChart extends AbstractAnimatedChart {
	
	private static readonly chromaticScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	private static readonly chromaticScaleInSolfege = FrequencyBarChart.chromaticScale.map(translateToSolfegeNotation);
	
	private readonly canvasCtx: CanvasRenderingContext2D;
	
	private mouseMoveHandler: MouseEventHandler;
	private mouseUpHandler: MouseEventHandler;
	private mouseDownHandler: MouseEventHandler;
	private startX: number;
	private width: number;
	private height: number;
	private barUnitWidth: number;
	private barUnitSpacingWidth: number;
	
	public options: IFrequencyBarChartOptions;
	
	constructor (readonly canvasElem: HTMLCanvasElement, analyserNode: AnalyserNode) {
		super(analyserNode);
		this.canvasCtx = canvasElem.getContext('2d');
		this.options = {
			drawLabels: true,
			drawChromaticScale: false,
			useSolfegeNotation: false,
			clearCanvas: true,
			logScale: false,
			scaleX: 1,
			barFillStyle: this.defaultBarFillStyle.bind(this)
		};
	}

	private registerMouseEvents() {
		var isDragging = false;

		this.canvasElem.addEventListener('mousedown', this.mouseDownHandler = () => {
			isDragging = true;
		});
		
		this.canvasElem.addEventListener('mousemove', this.mouseMoveHandler = (evt: MouseEvent) => {
			if (isDragging) {
				this.startX = Math.min(0, this.startX + evt.movementX);
			}
		});

		this.canvasElem.addEventListener('mouseup', this.mouseUpHandler = () => {
			isDragging = false;
		});
	}

	private unregisterMouseEvents() {
		this.canvasElem.removeEventListener('mousemove', this.mouseMoveHandler);
		this.canvasElem.removeEventListener('mouseup', this.mouseUpHandler);
		this.canvasElem.removeEventListener('mousedown', this.mouseDownHandler);
	}
		
	public start() {
		super.start();
		this.registerMouseEvents();
	}

	public stop() {
		super.stop();
		this.unregisterMouseEvents();
	}

	public reset() {
		this.data = new Uint8Array(this.analyserNode.frequencyBinCount);
		this.width = this.canvasElem.width / this.options.scaleX;
		this.height = this.canvasElem.height;

		this.startX = 0;

		const spacingTotalWidth = this.width / 10;
		this.barUnitWidth = (this.width - spacingTotalWidth) / this.data.length;
		this.barUnitSpacingWidth = spacingTotalWidth / (this.data.length - 1);
	}

	private defaultBarFillStyle(barIdx: number) {
		return 'rgb(' + (this.data[barIdx] / 2 + 150) + ', 0, 0)';
	}

	private drawNoteScale(noteScale: string[]) {
			const noteWidth = this.barUnitWidth + this.barUnitSpacingWidth;
			const noteSectionWidth = noteScale.length * noteWidth;
			const labelMargin = 5;
			const maxNoteTextWidth = noteWidth - 2;

			var octavePos = 0;
			var frequency = 16.35; // start in C_0 note frequency, which is 16.35 Hz
			var x = this.startX + Math.log2(frequency) * noteSectionWidth - noteWidth / 2;
			var evenIteration = true;

			while (x < this.canvasElem.width) {
				// fill section background in a even/odd pattern
				this.canvasCtx.fillStyle = evenIteration ? '#222222' : 'black';
				this.canvasCtx.fillRect(x, 0, noteSectionWidth, this.canvasElem.height);
				
				// divide the section in sub-sections for each note (if readable at all)
				const octaveText = numberToSubscript(octavePos);
				const sampleNote = noteScale[0] + octaveText;
				if (checkIfTextFits(this.canvasCtx, sampleNote, maxNoteTextWidth)) {
					noteScale.forEach((note, idx) => {
						const noteX = x + idx * noteWidth;
						const noteMaxX = noteX + noteWidth - 1;
						const startY = 30;

						this.canvasCtx.strokeStyle = 'gray';
						this.canvasCtx.beginPath();
						this.canvasCtx.moveTo(noteMaxX, startY);
						this.canvasCtx.lineTo(noteMaxX, this.canvasElem.height);
						this.canvasCtx.stroke();
						
						this.canvasCtx.fillStyle = 'gray';
						this.canvasCtx.textAlign = 'center';
						fillTextIfFits(this.canvasCtx, note + octaveText, noteX + noteWidth / 2 - 1, startY, maxNoteTextWidth);
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

	private drawFrequencyBars(chromaticScale: string[]) {
		const maxFrequency = this.analyserNode.context.sampleRate / 2;
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

			if (x >= this.canvasElem.width) {
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

			this.canvasCtx.fillStyle = this.options.barFillStyle(i);
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

	protected draw() {
		this.analyserNode.getByteFrequencyData(this.data);

		if (this.options.clearCanvas) {
			this.canvasCtx.fillStyle = 'black';
			this.canvasCtx.fillRect(0, 0, this.canvasElem.width, this.canvasElem.height);
		}

		var chromaticScale = this.options.useSolfegeNotation ? 
			FrequencyBarChart.chromaticScaleInSolfege :
			FrequencyBarChart.chromaticScale;

		if (this.options.drawChromaticScale && this.options.logScale) {
			this.drawNoteScale(chromaticScale);
		}
		
		this.drawFrequencyBars(chromaticScale);
	}

}

const waveformChart = new WaveformChart(waveformCanvasElem, analyserNode);

const originalWaveformChart = new WaveformChart(waveformCanvasElem, originalAnalyserNode);
originalWaveformChart.options.lineStrokeStyle = () => 'darkgreen';

const frequencyBarChart = new FrequencyBarChart(frequencyCanvasElem, analyserNode);

const originalFreqBarChart = new FrequencyBarChart(frequencyCanvasElem, originalAnalyserNode);
originalFreqBarChart.options.barFillStyle = (barIdx: number) => 'gray';

const charts: IAnimatedChart[] = [waveformChart, frequencyBarChart];

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
			frequencyBarChart.options.scaleX = useLogScale ? Math.pow(2, -7) : 1; // useful default

			originalFreqBarChart.options.logScale = useLogScale;
			originalFreqBarChart.options.scaleX = frequencyBarChart.options.scaleX;
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
	frequencyBarChart.options.scaleX /= 2;
	frequencyBarChart.reset();

	originalFreqBarChart.options.scaleX = frequencyBarChart.options.scaleX;
	originalFreqBarChart.reset();
});

const zoomOutElem = document.getElementById('zoomOutBtn');
zoomOutElem.addEventListener('click', function () {
	frequencyBarChart.options.scaleX *= 2;
	frequencyBarChart.reset();

	originalFreqBarChart.options.scaleX = frequencyBarChart.options.scaleX;
	originalFreqBarChart.reset();
});

const zoomResetElem = document.getElementById('zoomResetBtn');
zoomResetElem.addEventListener('click', function () {
	frequencyBarChart.options.scaleX = 1;
	frequencyBarChart.reset();

	originalFreqBarChart.options.scaleX = 1;
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