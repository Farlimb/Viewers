import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import debounce from 'lodash.debounce';

import Icon from '../Icon';
import Tooltip from '../Tooltip';
import InputRange from '../InputRange';

import './CinePlayer.css';

export type CinePlayerProps = {
  className: string;
  isPlaying: boolean;
  minFrameRate?: number;
  maxFrameRate?: number;
  stepFrameRate?: number;
  frameRate?: number;
  frameStart?: number; // Added prop for frame range start
  frameEnd?: number; // Added prop for frame range end
  onFrameRateChange: (value: number) => void;
  onPlayPauseChange: (value: boolean) => void;
  onClose: () => void;
  handleFrameRangeChange: (start: number, end: number) => void; // Added handler for frame range change
  updateDynamicInfo?: () => void;
  dynamicInfo?: {
    timePointIndex: number;
    numTimePoints: number;
    label?: string;
  };
};

const fpsButtonClassNames =
  'cursor-pointer text-primary-active active:text-primary-light hover:bg-customblue-300 w-4 flex items-center justify-center';

const CinePlayer: React.FC<CinePlayerProps> = ({
  className,
  isPlaying,
  minFrameRate,
  maxFrameRate,
  stepFrameRate,
  frameRate: defaultFrameRate,
  frameStart: defaultFrameStart, // Added prop for frame range start
  frameEnd: defaultFrameEnd, // Added prop for frame range end
  dynamicInfo = {},
  onFrameRateChange,
  onPlayPauseChange,
  handleFrameRangeChange, // Added handler for frame range change
  onClose,
  updateDynamicInfo,
}) => {
  const isDynamic = !!dynamicInfo?.numTimePoints;
  const [frameRate, setFrameRate] = useState(defaultFrameRate);
  const debouncedSetFrameRate = useCallback(debounce(onFrameRateChange, 100), [onFrameRateChange]);
  const [frameStart, setFrameStart] = useState(defaultFrameStart || 1); // Initialize frame start state
  const [frameEnd, setFrameEnd] = useState(defaultFrameEnd || 50); // Initialize frame end state

  const getPlayPauseIconName = () => (isPlaying ? 'icon-pause' : 'icon-play');

  // Handlers for frame range changes
  const handleFrameRangeStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      setFrameStart(value);
      handleFrameRangeChange(value, frameEnd); // Call handler function with updated frame start
    }
  };

  const handleFrameRangeEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      setFrameEnd(value);
      handleFrameRangeChange(frameStart, value); // Call handler function with updated frame end
    }
  };

  const handleSetFrameRate = (frameRate: number) => {
    if (frameRate < minFrameRate || frameRate > maxFrameRate) {
      return;
    }
    setFrameRate(frameRate);
    debouncedSetFrameRate(frameRate);
  };

  useEffect(() => {
    setFrameRate(defaultFrameRate);
  }, [defaultFrameRate]);

  const handleTimePointChange = useCallback(
    (newIndex: number) => {
      if (isDynamic && dynamicInfo) {
        // Here, you would update the component's state or context that controls the current time point index
        // For demonstration, assuming a hypothetical function that updates the time point index
        updateDynamicInfo({
          ...dynamicInfo,
          timePointIndex: newIndex,
        });
      }
    },
    [isDynamic, dynamicInfo]
  );

  return (
    <div className={className}>
      {isDynamic && dynamicInfo && (
        <InputRange
          value={dynamicInfo.timePointIndex}
          onChange={handleTimePointChange}
          minValue={0}
          maxValue={dynamicInfo.numTimePoints - 1}
          step={1}
          containerClassName="mb-3 w-full"
          labelClassName="text-xs text-white"
          leftColor="#3a3f99"
          rightColor="#3a3f99"
          trackHeight="4px"
          thumbColor="#348cfd"
          thumbColorOuter="#000000"
          showLabel={false}
        />
      )}
      <div
        className={
          'border-secondary-light/60 bg-primary-dark inline-flex select-none items-center gap-2 rounded border px-2 py-2'
        }
      >
        <Icon
          name={getPlayPauseIconName()}
          className="active:text-primary-light hover:bg-customblue-300 cursor-pointer text-white hover:rounded"
          onClick={() => onPlayPauseChange(!isPlaying)}
        />
        {isDynamic && dynamicInfo && (
          <div className="min-w-16 max-w-44 flex flex-col  text-white">
            {/* Add Tailwind classes for monospace font and center alignment */}
            <div className="text-[11px]">
              <span className="w-2 text-white">{dynamicInfo.timePointIndex}</span>{' '}
              <span className="text-aqua-pale">{`/${dynamicInfo.numTimePoints}`}</span>
            </div>
            <div className="text-aqua-pale text-xs">{dynamicInfo.label}</div>
          </div>
        )}

        <div className="border-secondary-light ml-4 flex h-6 items-stretch gap-1 rounded border">
          <div
            className={`${fpsButtonClassNames} rounded-l`}
            onClick={() => handleSetFrameRate(frameRate - 1)}
          >
            <Icon name="arrow-left-small" />
          </div>
          <Tooltip
            position="top"
            className="group/fps cine-fps-range-tooltip"
            tight={true}
            content={
              <InputRange
                containerClassName="h-9 px-2"
                inputClassName="w-40"
                value={frameRate}
                minValue={minFrameRate}
                maxValue={maxFrameRate}
                step={stepFrameRate}
                onChange={handleSetFrameRate}
                showLabel={false}
              />
            }
          >
            <div className="flex items-center justify-center gap-1">
              <div className="flex-shrink-0 text-center text-sm leading-[22px] text-white">
                <span className="inline-block text-right">{`${frameRate} `}</span>
                <span className="text-aqua-pale whitespace-nowrap text-xs">{' FPS'}</span>
              </div>
            </div>
          </Tooltip>
          <input
            type="number"
            value={frameStart}
            onChange={handleFrameRangeStartChange}
            className="border-secondary-light bg-primary-dark w-12 rounded border px-2 py-1 text-white"
          />
          <span className="text-white">-</span>
          <input
            type="number"
            value={frameEnd}
            onChange={handleFrameRangeEndChange}
            className="border-secondary-light bg-primary-dark w-12 rounded border px-2 py-1 text-white"
          />
          <div
            className={`${fpsButtonClassNames} rounded-r`}
            onClick={() => handleSetFrameRate(frameRate + 1)}
          >
            <Icon name="arrow-right-small" />
          </div>
        </div>
        <Icon
          name="icon-close"
          className="text-primary-active active:text-primary-light hover:bg-customblue-300 cursor-pointer hover:rounded"
          onClick={onClose}
        />
      </div>
    </div>
  );
};

const noop = () => {};

CinePlayer.defaultProps = {
  isPlaying: false,
  minFrameRate: 1,
  maxFrameRate: 90,
  stepFrameRate: 1,
  frameRate: 24,

  onPlayPauseChange: noop,
  onFrameRateChange: noop,
  onClose: noop,
  isDynamic: false,
  dynamicInfo: {},
};

CinePlayer.propTypes = {
  /** Minimum value for range slider */
  minFrameRate: PropTypes.number,
  /** Maximum value for range slider */
  maxFrameRate: PropTypes.number,
  /** Increment range slider can "step" in either direction */
  stepFrameRate: PropTypes.number,
  frameRate: PropTypes.number,
  /** 'true' if playing, 'false' if paused */
  isPlaying: PropTypes.bool.isRequired,
  onPlayPauseChange: PropTypes.func,
  onFrameRateChange: PropTypes.func,
  onClose: PropTypes.func,
  isDynamic: PropTypes.bool,
  dynamicInfo: PropTypes.shape({
    timePointIndex: PropTypes.number,
    numTimePoints: PropTypes.number,
    label: PropTypes.string,
  }),
  // PropTypes for frame range start and end
  frameStart: PropTypes.number,
  frameEnd: PropTypes.number,
  // PropTypes for handler function for frame range change
  handleFrameRangeChange: PropTypes.func,
};

export default CinePlayer;
