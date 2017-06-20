import 'babel-polyfill';
import { reducer as formReducer } from 'redux-form';
import { combineReducers } from 'redux';
import { routerReducer } from 'react-router-redux';
import { cloud_access } from './IdentityAccess/reducers';
import { certificate } from './Certificate/reducers';
import { login } from './Login/reducers';
import { submission } from './Submission/reducers';
import { query_nodes } from './QueryNode/reducers';
import { popups } from './Popup/reducers';

const status = (state={}, action) => {
  switch (action.type){
    case 'REQUEST_ERROR':
      return {...state, 'request_state': 'error', 'error_type': action.error};
    default:
      return state
  }
};

const user = (state={}, action) => {
  switch (action.type) {
    case 'RECEIVE_USER':
      return {...state, ...action.user, fetched_user: true};
    case 'REGISTER_ROLE':
      return {
        ...state, role_arn:action.role_arn};
    case 'RECEIVE_VPC':
      return {
        ...state, vpc: action.vpc
      };
    case 'RECEIVE_AUTHORIZATION_URL':
      return {...state, oauth_url:action.url};
    case 'FETCH_ERROR':
      return {...state, fetched_user: true, fetch_error: action.error};
    default:
      return state
  }
};

const removeDeletedNode = (state, id) =>{
  let search_result = state.search_result;
  console.log(search_result);
  // graphql response should always be {data: {node_type: [ nodes ] }}
  let node_type = Object.keys(search_result['data'])[0];
  let entities = search_result['data'][node_type];
  search_result['data'][node_type] = entities.filter((entity) => entity['id'] !== id);
  return search_result;
};

const reducers = combineReducers({popups, login, user, status, submission, query_nodes, cloud_access, certificate, form: formReducer, routing:routerReducer});

export default reducers