use actix::prelude::*;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use serde_json::Result;
use log::{debug, error};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "PascalCase"))]
pub enum ComponentRole {
    Cursor,
    Builder,
    Text,
    Counter,
    Image,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct Hand {
    id: usize,
    x: f64,
    y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct Component {
    id: usize,
    role: ComponentRole,
    selectability: bool,
    is_opened: bool,
    is_selected: bool,
    user: Option<usize>,
    hide_others: bool,
    text: String,
    number: i64,
    image: Option<String>,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

impl Component {
    pub fn card(id: usize, 
        selectability: bool,
        is_opened: bool,
        user: Option<usize>,
        hide_others: bool,
        text: String,
        x: f64, y: f64, w: f64, h: f64,
    ) -> Self {
        Self {
            id,
            role: ComponentRole::Text,
            selectability,
            is_opened,
            is_selected: false,
            user,
            hide_others,
            text,
            number: 0, image: None,
            x, y, w, h,
        }
    }

    pub fn counter(id: usize,
        user: Option<usize>,
        number: i64,
        x: f64, y: f64, w: f64, h: f64,
    ) -> Self {
        Self {
            id,
            role: ComponentRole::Counter,
            selectability: false,
            is_opened: true,
            is_selected: false,
            user,
            hide_others: false,
            text: String::new(),
            number,
            image: None,
            x, y, w, h,
        }
    }
}

fn create_components() -> Vec<Component> {
    vec![
        Component::card(0, true, true, Some(1), false,
            "プレイヤー1の操作カード".to_owned(), 32., 32., 100., 100.),
        Component::card(1, true, true, Some(2), false,
            "プレイヤー2の操作カード".to_owned(), 96., 32., 100., 100.),
        Component::card(2, true, true, None, false,
            "みんな操作できるカード".to_owned(), 32., 96., 100., 100.),
        Component::card(3, true, true, Some(1), true,
            "プレイヤー1しか見えない".to_owned(), 96., 96., 100., 100.),
        Component::card(4, true, true, Some(2), true,
            "プレイヤー2しか見えない".to_owned(), 64., 64., 100., 100.),
        Component::counter(5, Some(1), 0, 160., 32., 100., 100.),
        Component::counter(6, Some(2), 0, 160., 96., 100., 100.),
    ]
}

pub struct WsActor {
    sessions: HashMap<u32, Recipient<Message>>,
    players: Vec<u32>,
    components: Vec<Component>,
    hands: HashMap<u32, Hand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all(serialize = "camelCase", deserialize = "PascalCase"))]
pub enum Notification {
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    ConnectPlayer{player_number: usize, hand: Hand},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    DisconnectPlayer{player_number: usize},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    PlayerNumber{player_number: usize},
    SetComponents{components: Vec<Component>},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    UpdateComponent{component_id: usize, component: Component},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    SelectComponent{component_id: usize},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    UnselectComponent{component_id: usize},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    OpenComponent{component_id: usize},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    CloseComponent{component_id: usize},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    IncrementComponent{component_id: usize},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    DecrementComponent{component_id: usize},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    MoveComponent{component_id: usize, x: f64, y: f64},

    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    SetHands{hands: Vec<Hand>},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    MoveOwnHand{x: f64, y: f64},
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    MoveHand{player_number: usize, x: f64, y: f64},
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Message(pub Vec<Notification>);

#[derive(Message)]
#[rtype(u32)]
pub struct Connect {
    pub addr: Recipient<Message>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub id: u32,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct ClientMessage {
    pub id: u32,
    pub msg: String,
}

impl WsActor {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            players: Vec::new(),
            components: create_components(),
            hands: HashMap::new(),
        }
    }

    fn send_message(&self, message: Vec<Notification>) {
        for (_, addr) in &self.sessions {
            let _ = addr.do_send(Message(message.clone()));
        }
    }

    fn send_message_except(&self, client_id: u32, message: Vec<Notification>) {
        for (&cid, addr) in &self.sessions {
            if cid == client_id {
                continue;
            }
            let _ = addr.do_send(Message(message.clone()));
        }
    }

    fn notify_all_player_numbers(&self) {
        for (&cid, addr) in &self.sessions {
            let player_number = self.players.iter().position(|&r| r == cid).unwrap() + 1;
            let _ = addr.do_send(Message(vec![Notification::PlayerNumber{player_number}]));
        }
    }
}

impl Actor for WsActor {
    type Context = Context<Self>;
}

trait Notify {
    fn notify(&self, one: Notification);
    fn notifies(&self, multi: Vec<Notification>);
}

impl Notify for Recipient<Message> {
    fn notify(&self, one: Notification) {
        self.do_send(Message(vec![one])).expect("could not notify");
    }

    fn notifies(&self, multi: Vec<Notification>) {
        self.do_send(Message(multi)).expect("could not notify");
    }
}

impl Handler<Connect> for WsActor {
    type Result = u32;

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) -> Self::Result {
        let client_id = rand::random::<u32>();
        self.players.push(client_id);
        let player_index = self.players.iter().position(|&r| r == client_id).unwrap();
        let player_number = player_index + 1;
        self.hands.insert(client_id, Hand {id: player_number, x: 0., y: 0.});
        
        msg.addr.notifies(vec![
            Notification::PlayerNumber{player_number},
            Notification::SetComponents{components: self.components.clone()},
            Notification::SetHands{hands: self.players.iter().map(|cid| self.hands.get(cid).unwrap().clone()).collect()}
            ]);

        self.sessions.insert(client_id, msg.addr);

        self.send_message(vec![
            Notification::ConnectPlayer{player_number, hand: self.hands.get(&client_id).unwrap().clone()}
        ]);

        client_id
    }
}

impl Handler<Disconnect> for WsActor {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        let client_id = msg.id;
        let player_index = self.players.iter().position(|&r| r == client_id).unwrap();
        let player_number = player_index + 1;
        self.send_message(vec![
            Notification::DisconnectPlayer{player_number}
        ]);
        self.sessions.remove(&client_id);
        self.hands.remove(&client_id);
        self.players.retain(|&r| r != client_id);
        self.notify_all_player_numbers();
    }
}

impl Handler<ClientMessage> for WsActor {
    type Result = ();

    fn handle(&mut self, msg: ClientMessage, _: &mut Context<Self>) {
        //debug!("Message from client: {}", msg.msg);
        let client_id = msg.id;
        let player_number = self.players.iter().position(|&r| r == client_id).unwrap() + 1;

        match serde_json::from_str::<Notification>(&msg.msg) {
            Ok(notif) => {
                match notif {
                    Notification::SelectComponent{component_id} => {
                        self.components[component_id].is_selected = true;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.components[component_id].clone()}
                        ]);
                    }
                    Notification::UnselectComponent{component_id} => {
                        self.components[component_id].is_selected = false;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.components[component_id].clone()}
                        ]);
                    }
                    Notification::OpenComponent{component_id} => {
                        self.components[component_id].is_opened = true;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.components[component_id].clone()}
                        ]);
                    }
                    Notification::CloseComponent{component_id} => {
                        self.components[component_id].is_opened = false;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.components[component_id].clone()}
                        ]);
                    }
                    Notification::IncrementComponent{component_id} => {
                        self.components[component_id].number += 1;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.components[component_id].clone()}
                        ]);
                    }
                    Notification::DecrementComponent{component_id} => {
                        self.components[component_id].number -= 1;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.components[component_id].clone()}
                        ]);
                    }
                    Notification::MoveComponent{component_id, x, y} => {
                        if let Some(user_number) = self.components[component_id].user {
                            if user_number != player_number {
                                debug!("could not move the component");
                                return;
                            }
                        }
                        self.components[component_id].x = x;
                        self.components[component_id].y = y;
                        self.send_message_except(msg.id, vec![
                            Notification::UpdateComponent {component_id, component: self.components[component_id].clone()}
                        ]);
                    }
                    Notification::MoveOwnHand{x, y} => {
                        let hand = self.hands.get_mut(&msg.id).unwrap();
                        hand.x = x;
                        hand.y = y;
                        self.send_message_except(msg.id, vec![
                            Notification::MoveHand {player_number, x, y}
                        ]);
                    }
                    _ => {
                        debug!("Notification from client {}: {:?}", client_id, notif)
                    }
                }
            }
            Err(e) => error!("{} on {:?}", e, msg.msg)
        }
    }
}