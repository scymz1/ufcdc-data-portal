// src/GuppyDataExplorer/ExplorerFilter/EventTypeFilter/index.jsx
import React from 'react';
import PropTypes from 'prop-types';

class EventTypeFilter extends React.Component {
  constructor(props) {
    super(props);
    
    this.START_EVENTS = ['diagnose', 'progression', 'recurrence', 'sample', 'treatment'];
    this.OUTCOME_EVENTS = ['dead', 'progression', 'recurrence'];
    
    this.state = {
      selectedStart: this.getInitialSelected(this.START_EVENTS),
      selectedOutcome: this.getInitialSelected(this.OUTCOME_EVENTS)
    };
  }

  getInitialSelected(events) {
    const { currentFilters } = this.props;
    return events.filter(event => 
      currentFilters?.selectedValues?.includes(event)
    );
  }

  componentDidUpdate(prevProps) {
    console.log('EventTypeFilter options:', this.props.options);
    
    if (prevProps.currentFilters !== this.props.currentFilters) {
      this.setState({
        selectedStart: this.getInitialSelected(this.START_EVENTS),
        selectedOutcome: this.getInitialSelected(this.OUTCOME_EVENTS)
      });
    }
  }

  getEventInfo = (event) => {
    const { options } = this.props;
    const option = options.find(opt => opt.key === event);
    return {
      exists: !!option,
      count: option?.count || 0
    };
  }

  handleStartChange = (event, checked) => {
    const { selectedStart } = this.state;
    const newSelected = checked 
      ? [...selectedStart, event]
      : selectedStart.filter(v => v !== event);
    
    this.setState({ selectedStart: newSelected }, () => {
      this.updateFilter();
    });
  }

  handleOutcomeChange = (event, checked) => {
    const { selectedOutcome } = this.state;
    const newSelected = checked 
      ? [...selectedOutcome, event]
      : selectedOutcome.filter(v => v !== event);
    
    this.setState({ selectedOutcome: newSelected }, () => {
      this.updateFilter();
    });
  }

  updateFilter = () => {
    const { selectedStart, selectedOutcome } = this.state;
    const { field, onFilterChange } = this.props;
    
    const selectedValues = [...selectedStart, ...selectedOutcome];
    if (selectedValues.length > 0) {
      onFilterChange(field, {
        selectedValues
      });
    }
  }

  renderCheckboxGroup = (title, events, selectedValues, onChangeHandler) => {
    const items = events.map(event => {
      const { exists, count } = this.getEventInfo(event);
      
      return (
        <div key={event} className="event-type-option">
          <label className="event-type-option__label">
            <input
              type="checkbox"
              checked={selectedValues.includes(event)}
              disabled={!exists}
              onChange={(e) => onChangeHandler(event, e.target.checked)}
              className="event-type-option__checkbox"
            />
            <span className={`event-type-option__text ${!exists ? 'disabled' : ''}`}>
              {event}
            </span>
            <span className="event-type-option__count">
              ({exists ? count : 'no data'})
            </span>
          </label>
        </div>
      );
    });

    return (
      <div className="event-type-section">
        <div className="event-type-section__header">
          {title}
        </div>
        <div className="event-type-section__content">
          {items}
        </div>
      </div>
    );
  }

  render() {
    const { selectedStart, selectedOutcome } = this.state;

    return (
      <div className="filter-section filter-section--event-type">
        <div className="filter-section__content">
          {this.renderCheckboxGroup(
            'Start Index', 
            this.START_EVENTS, 
            selectedStart, 
            this.handleStartChange
          )}
          <div className="filter-section__divider" />
          {this.renderCheckboxGroup(
            'Outcome', 
            this.OUTCOME_EVENTS, 
            selectedOutcome, 
            this.handleOutcomeChange
          )}
        </div>
      </div>
    );
  }
}

EventTypeFilter.propTypes = {
  field: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    count: PropTypes.number
  })),
  onFilterChange: PropTypes.func.isRequired,
  currentFilters: PropTypes.shape({
    selectedValues: PropTypes.arrayOf(PropTypes.string)
  })
};

EventTypeFilter.defaultProps = {
  options: [],
  currentFilters: null
};

export default EventTypeFilter;