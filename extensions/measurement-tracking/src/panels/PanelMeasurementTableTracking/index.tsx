import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  StudySummary,
  MeasurementTable,
  useViewportGrid,
  ActionButtons,
  Modal,
  InputText,
  InputNumber,
  Label,
} from '@ohif/ui';
import { DicomMetadataStore, utils } from '@ohif/core';
import { useDebounce } from '@hooks';
import { useAppConfig } from '@state';
import { useTrackedMeasurements } from '../../getContextModule';
import debounce from 'lodash.debounce';
import { useTranslation } from 'react-i18next';

const { downloadCSVReport } = utils;
const { formatDate } = utils;

const DISPLAY_STUDY_SUMMARY_INITIAL_VALUE = {
  key: undefined, //
  date: '', // '07-Sep-2010',
  modality: '', // 'CT',
  description: '', // 'CHEST/ABD/PELVIS W CONTRAST',
};

function PanelMeasurementTableTracking({ servicesManager, extensionManager }) {
  const [viewportGrid] = useViewportGrid();
  const { t } = useTranslation('MeasurementTable');
  const [measurementChangeTimestamp, setMeasurementsUpdated] = useState(Date.now().toString());
  const debouncedMeasurementChangeTimestamp = useDebounce(measurementChangeTimestamp, 200);
  const { measurementService, uiDialogService, displaySetService, customizationService } =
    servicesManager.services;
  const [trackedMeasurements, sendTrackedMeasurementsEvent] = useTrackedMeasurements();
  const { trackedStudy, trackedSeries } = trackedMeasurements.context;
  const [displayStudySummary, setDisplayStudySummary] = useState(
    DISPLAY_STUDY_SUMMARY_INITIAL_VALUE
  );
  const [displayMeasurements, setDisplayMeasurements] = useState([]);
  const measurementsPanelRef = useRef(null);
  const [appConfig] = useAppConfig();
  const [isModalOpen1, setIsModalOpen1] = useState(false);
  const [isModalOpen2, setIsModalOpen2] = useState(false);
  const [isModalOpen3, setIsModalOpen3] = useState(false);

  useEffect(() => {
    const measurements = measurementService.getMeasurements();
    const filteredMeasurements = measurements.filter(
      m => trackedStudy === m.referenceStudyUID && trackedSeries.includes(m.referenceSeriesUID)
    );

    const mappedMeasurements = filteredMeasurements.map(m =>
      _mapMeasurementToDisplay(m, measurementService.VALUE_TYPES, displaySetService)
    );
    setDisplayMeasurements(mappedMeasurements);
    // eslint-ignore-next-line
  }, [measurementService, trackedStudy, trackedSeries, debouncedMeasurementChangeTimestamp]);

  const updateDisplayStudySummary = async () => {
    if (trackedMeasurements.matches('tracking')) {
      const StudyInstanceUID = trackedStudy;
      const studyMeta = DicomMetadataStore.getStudy(StudyInstanceUID);
      const instanceMeta = studyMeta.series[0].instances[0];
      const { StudyDate, StudyDescription } = instanceMeta;

      const modalities = new Set();
      studyMeta.series.forEach(series => {
        if (trackedSeries.includes(series.SeriesInstanceUID)) {
          modalities.add(series.instances[0].Modality);
        }
      });
      const modality = Array.from(modalities).join('/');

      if (displayStudySummary.key !== StudyInstanceUID) {
        setDisplayStudySummary({
          key: StudyInstanceUID,
          date: StudyDate, // TODO: Format: '07-Sep-2010'
          modality,
          description: StudyDescription,
        });
      }
    } else if (trackedStudy === '' || trackedStudy === undefined) {
      setDisplayStudySummary(DISPLAY_STUDY_SUMMARY_INITIAL_VALUE);
    }
  };

  // ~~ DisplayStudySummary
  useEffect(() => {
    updateDisplayStudySummary();
  }, [displayStudySummary.key, trackedMeasurements, trackedStudy, updateDisplayStudySummary]);

  // TODO: Better way to consolidated, debounce, check on change?
  // Are we exposing the right API for measurementService?
  // This watches for ALL measurementService changes. It updates a timestamp,
  // which is debounced. After a brief period of inactivity, this triggers
  // a re-render where we grab up-to-date measurements
  useEffect(() => {
    const added = measurementService.EVENTS.MEASUREMENT_ADDED;
    const addedRaw = measurementService.EVENTS.RAW_MEASUREMENT_ADDED;
    const updated = measurementService.EVENTS.MEASUREMENT_UPDATED;
    const removed = measurementService.EVENTS.MEASUREMENT_REMOVED;
    const cleared = measurementService.EVENTS.MEASUREMENTS_CLEARED;
    const subscriptions = [];

    [added, addedRaw, updated, removed, cleared].forEach(evt => {
      subscriptions.push(
        measurementService.subscribe(evt, () => {
          setMeasurementsUpdated(Date.now().toString());
          if (evt === added) {
            debounce(() => {
              measurementsPanelRef.current.scrollTop = measurementsPanelRef.current.scrollHeight;
            }, 300)();
          }
        }).unsubscribe
      );
    });

    return () => {
      subscriptions.forEach(unsub => {
        unsub();
      });
    };
  }, [measurementService, sendTrackedMeasurementsEvent]);

  async function exportReport() {
    const measurements = measurementService.getMeasurements();
    const trackedMeasurements = measurements.filter(
      m => trackedStudy === m.referenceStudyUID && trackedSeries.includes(m.referenceSeriesUID)
    );

    downloadCSVReport(trackedMeasurements, measurementService);
  }

  const jumpToImage = ({ uid, isActive }) => {
    measurementService.jumpToMeasurement(viewportGrid.activeViewportId, uid);

    onMeasurementItemClickHandler({ uid, isActive });
  };

  const onMeasurementItemEditHandler = ({ uid, isActive }) => {
    jumpToImage({ uid, isActive });
    const labelConfig = customizationService.get('measurementLabels');
    const measurement = measurementService.getMeasurement(uid);
    const utilityModule = extensionManager.getModuleEntry(
      '@ohif/extension-cornerstone.utilityModule.common'
    );
    const { showLabelAnnotationPopup } = utilityModule.exports;
    showLabelAnnotationPopup(measurement, uiDialogService, labelConfig).then(
      (val: Map<any, any>) => {
        measurementService.update(
          uid,
          {
            ...val,
          },
          true
        );
      }
    );
  };

  const onMeasurementItemClickHandler = ({ uid, isActive }) => {
    if (!isActive) {
      const measurements = [...displayMeasurements];
      const measurement = measurements.find(m => m.uid === uid);

      measurements.forEach(m => (m.isActive = m.uid !== uid ? false : true));
      measurement.isActive = true;
      setDisplayMeasurements(measurements);
    }
  };

  const displayMeasurementsWithoutFindings = displayMeasurements.filter(
    dm => dm.measurementType !== measurementService.VALUE_TYPES.POINT
  );
  const additionalFindings = displayMeasurements.filter(
    dm => dm.measurementType === measurementService.VALUE_TYPES.POINT
  );

  const disabled =
    additionalFindings.length === 0 && displayMeasurementsWithoutFindings.length === 0;

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bloodPresure, setBloodPresure] = useState('');
  const [refferingPI, setRefferingPI] = useState('');
  const [interpretingPI, setInterpretingPI] = useState('');
  const [dateOfStudy, setDateOfStudy] = useState('');
  const [ECHGInstrumentIdentification, setECHGInstrumentIdentification] = useState('');
  const [endDiastole, setEndDiastole] = useState('');
  const [endSystole, setEndSystole] = useState('');
  const [wallThickness, setWallThickness] = useState('');
  const [functionAssesment, setFunctionAssesment] = useState('');

  return (
    <>
      <div
        className="invisible-scrollbar overflow-y-auto overflow-x-hidden"
        ref={measurementsPanelRef}
        data-cy={'trackedMeasurements-panel'}
      >
        {displayStudySummary.key && (
          <StudySummary
            date={formatDate(displayStudySummary.date)}
            modality={displayStudySummary.modality}
            description={displayStudySummary.description}
          />
        )}
        <MeasurementTable
          title="Measurements"
          data={displayMeasurementsWithoutFindings}
          servicesManager={servicesManager}
          onClick={jumpToImage}
          onEdit={onMeasurementItemEditHandler}
        />
        {additionalFindings.length !== 0 && (
          <MeasurementTable
            title="Additional Findings"
            data={additionalFindings}
            servicesManager={servicesManager}
            onClick={jumpToImage}
            onEdit={onMeasurementItemEditHandler}
          />
        )}
      </div>
      {!appConfig?.disableEditing && (
        <div className="flex justify-center p-4">
          <ActionButtons
            t={t}
            actions={[
              {
                label: 'Export',
                onClick: exportReport,
              },
              {
                label: 'Create Report',
                onClick: () => {
                  sendTrackedMeasurementsEvent('SAVE_REPORT', {
                    viewportId: viewportGrid.activeViewportId,
                    isBackupSave: true,
                  });
                },
              },
            ]}
            disabled={disabled}
          />
        </div>
      )}
      <ActionButtons
        t={t}
        actions={[
          {
            label: 'Add Heart USG SR Report',
            onClick: () => {
              setIsModalOpen1(true);
            },
          },
        ]}
      />
      <Modal
        closeButton
        shouldCloseOnEsc
        isOpen={isModalOpen1}
        title={'Echocardiography report'}
        onClose={() => {
          setIsModalOpen1(false);
        }}
      >
        <form>
          <div className="modal-content">
            <p>Patient's personal information</p>
            <br />
            <label>
              <InputText
                label="Patient`s name"
                value={name}
                onChange={newValue => {
                  setName(newValue);
                }}
              />
            </label>
            <br />
            <label>
              <InputText
                label="Age"
                value={age}
                onChange={newValue => {
                  setAge(newValue);
                }}
              />
            </label>
            <br />
            <label>
              <InputText
                label="Gender"
                value={gender}
                onChange={newValue => {
                  setGender(newValue);
                }}
              />
            </label>
            <br />
            <label>
              <InputText
                label="Height"
                value={height}
                onChange={newValue => {
                  setHeight(newValue);
                }}
              />
            </label>
            <br />
            <label>
              <InputText
                label="Weight"
                value={weight}
                onChange={newValue => {
                  setWeight(newValue);
                }}
              />
            </label>
            <br />
            <label>
              <InputText
                label="Blood presure"
                value={bloodPresure}
                onChange={newValue => {
                  setBloodPresure(newValue);
                }}
              />
            </label>
            <br />
            <ActionButtons
              t={t}
              actions={[
                {
                  label: 'Next Step',
                  onClick: () => {
                    setIsModalOpen1(false);
                    setIsModalOpen2(true);
                  },
                },
              ]}
            />
            <br />
          </div>
        </form>
      </Modal>
      <Modal
        closeButton
        shouldCloseOnEsc
        isOpen={isModalOpen2}
        title={'Echocardiography report'}
        onClose={() => {
          setIsModalOpen2(false);
        }}
      >
        <form>
          <div className="modal-content">
            <p>Exam generic information</p>
            <br />
            <label>
              <InputText
                label="Referring physician identification"
                value={refferingPI}
                onChange={newValue => {
                  setRefferingPI(newValue);
                }}
              />
            </label>
            <br />
            <label>
              <InputText
                label="Interpreting physician identification"
                value={interpretingPI}
                onChange={newValue => {
                  setInterpretingPI(newValue);
                }}
              />
            </label>
            <br />
            <label>
              <InputText
                label="Date of study"
                value={dateOfStudy}
                onChange={newValue => {
                  setDateOfStudy(newValue);
                }}
              />
            </label>
            <br />
            <label>
              <InputText
                label="Echocardiographic instrument identification"
                value={ECHGInstrumentIdentification}
                onChange={newValue => {
                  setECHGInstrumentIdentification(newValue);
                }}
              />
            </label>
            <br />
            <ActionButtons
              t={t}
              actions={[
                {
                  label: 'NextStep',
                  onClick: () => {
                    setIsModalOpen2(false);
                    setIsModalOpen3(true);
                  },
                },
              ]}
            />
          </div>
        </form>
      </Modal>
      <Modal
        closeButton
        shouldCloseOnEsc
        isOpen={isModalOpen3}
        title={'Echocardiography report'}
        onClose={() => {
          setIsModalOpen3(false);
        }}
      >
        <form>
          <div className="modal-content">
            <p>Left venticle</p>
            <br />
            <label>
              <InputText
                label="End-diastole"
                value={endDiastole}
                onChange={newValue => {
                  setEndDiastole(newValue);
                }}
              />
            </label>
            <br />
            <label>
              <InputText
                label="End-systole"
                value={endSystole}
                onChange={newValue => {
                  setEndSystole(newValue);
                }}
              />
            </label>
            <br />
            <label>
              <InputText
                label="Wall thickness"
                value={wallThickness}
                onChange={newValue => {
                  setWallThickness(newValue);
                }}
              />
            </label>
            <br />
            <label>
              <InputText
                label="Function assesment"
                value={functionAssesment}
                onChange={newValue => {
                  setFunctionAssesment(newValue);
                }}
              />
            </label>
            <br />
            <ActionButtons
              t={t}
              actions={[
                {
                  label: 'Submit',
                  onClick: () => {
                    setIsModalOpen3(false);
                  },
                },
              ]}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}

PanelMeasurementTableTracking.propTypes = {
  servicesManager: PropTypes.shape({
    services: PropTypes.shape({
      measurementService: PropTypes.shape({
        getMeasurements: PropTypes.func.isRequired,
        VALUE_TYPES: PropTypes.object.isRequired,
      }).isRequired,
    }).isRequired,
  }).isRequired,
};

// TODO: This could be a measurementService mapper
function _mapMeasurementToDisplay(measurement, types, displaySetService) {
  const { referenceStudyUID, referenceSeriesUID, SOPInstanceUID } = measurement;

  // TODO: We don't deal with multiframe well yet, would need to update
  // This in OHIF-312 when we add FrameIndex to measurements.

  const instance = DicomMetadataStore.getInstance(
    referenceStudyUID,
    referenceSeriesUID,
    SOPInstanceUID
  );

  const displaySets = displaySetService.getDisplaySetsForSeries(referenceSeriesUID);

  if (!displaySets[0] || !displaySets[0].images) {
    throw new Error('The tracked measurements panel should only be tracking "stack" displaySets.');
  }

  const {
    displayText: baseDisplayText,
    uid,
    label: baseLabel,
    type,
    selected,
    findingSites,
    finding,
  } = measurement;

  const firstSite = findingSites?.[0];
  const label = baseLabel || finding?.text || firstSite?.text || '(empty)';
  let displayText = baseDisplayText || [];
  if (findingSites) {
    const siteText = [];
    findingSites.forEach(site => {
      if (site?.text !== label) {
        siteText.push(site.text);
      }
    });
    displayText = [...siteText, ...displayText];
  }
  if (finding && finding?.text !== label) {
    displayText = [finding.text, ...displayText];
  }

  return {
    uid,
    label,
    baseLabel,
    measurementType: type,
    displayText,
    baseDisplayText,
    isActive: selected,
    finding,
    findingSites,
  };
}

export default PanelMeasurementTableTracking;
