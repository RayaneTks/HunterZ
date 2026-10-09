import { supabase } from './supabase';
import type { PlayerLocation } from './types';
export type MatchState = 'briefing'|'running'|'paused'|'finished'|'cancelled';
export type MatchSnapshot = {
 id:string;roomId:string;revision:number;state:MatchState;role:'target'|'hunter';serverNow:string;elapsedSeconds:number;remainingSeconds:number;
 roster:{user_id:string;nickname:string;role:'target'|'hunter';ready:boolean;gpsReady:boolean}[];
 terrain:{latitude:number;longitude:number;radius_m:number;extractionLatitude:number;extractionLongitude:number};
 locations:PlayerLocation[];clue:{west:number;east:number;south:number;north:number;cellSize:number;generatedAt:string;ageBucket:'recent'|'old'}|null;
 capture:{id:string;hunterId:string;expiresAt:string}|null;
 pauseReason:string|null;result:{winner:'target'|'hunters';reason:'extraction'|'interception'|'timeout';duration:number}|null;
};
export async function getMatch(roomId:string):Promise<MatchSnapshot|null>{
 if(!supabase)throw new Error('Connexion indisponible');
 const {data,error}=await supabase.rpc('get_match',{p_room:roomId});if(error)throw error;return data as MatchSnapshot|null;
}
export async function matchAction(roomId:string,action:string,options:{target?:string;ready?:boolean;request?:string;actionId?:string}={}):Promise<MatchSnapshot>{
 if(!supabase)throw new Error('Connexion indisponible');
 const {data,error}=await supabase.rpc('hunt_match_action',{p_room:roomId,p_action:action,p_target:options.target??null,p_ready:options.ready??null,p_request:options.request??null,p_action_id:options.actionId??crypto.randomUUID()});if(error)throw error;return data as MatchSnapshot;
}
export const createMatch=(roomId:string,targetId:string)=>matchAction(roomId,'create',{target:targetId});
export const setReady=(roomId:string,ready:boolean,actionId:string)=>matchAction(roomId,'ready',{ready,actionId});
export const transitionMatch=(roomId:string,action:'start'|'pause'|'resume'|'cancel',actionId:string)=>matchAction(roomId,action,{actionId});
export const requestCapture=(roomId:string,actionId:string)=>matchAction(roomId,'capture',{actionId});
export const confirmCapture=(roomId:string,requestId:string,actionId:string)=>matchAction(roomId,'confirm',{request:requestId,actionId});
export const requestExtraction=(roomId:string,actionId:string)=>matchAction(roomId,'extract',{actionId});
export const rematch=(roomId:string,targetId:string,actionId:string)=>matchAction(roomId,'create',{target:targetId,actionId});
