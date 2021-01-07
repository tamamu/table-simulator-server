use actix::prelude::*;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use serde_json::Result;
use log::{debug, error};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ComponentRole {
    Cursor,
    Builder,
    Text,
    Counter,
    Image,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    x: i32,
    y: i32,
    w: i32,
    h: i32,
}

impl Component {
    pub fn card(id: usize, 
        selectability: bool,
        is_opened: bool,
        user: Option<usize>,
        hide_others: bool,
        text: String,
        x: i32, y: i32, w: i32, h: i32,
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
        x: i32, y: i32, w: i32, h: i32,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
    components: Vec<Component>,
}

impl std::default::Default for Table {
    fn default() -> Self {
        Self {
            components: vec![
                Component::card(0, true, true, Some(1), false,
                    "プレイヤー1の操作カード".to_owned(), 32, 32, 100, 100),
                Component::card(1, true, true, Some(2), false,
                    "プレイヤー2の操作カード".to_owned(), 96, 32, 100, 100),
                Component::card(2, true, true, None, false,
                    "みんな操作できるカード".to_owned(), 32, 96, 100, 100),
                Component::card(3, true, true, Some(1), true,
                    "プレイヤー1しか見えない".to_owned(), 96, 96, 100, 100),
                Component::card(4, true, true, Some(2), true,
                    "プレイヤー2しか見えない".to_owned(), 64, 64, 100, 100),
                Component::counter(5, Some(1), 0, 160, 32, 100, 100),
                Component::counter(6, Some(2), 0, 160, 96, 100, 100),
            ],
        }
    }
}

pub struct WsActor {
    sessions: HashMap<u32, Recipient<Message>>,
    players: Vec<u32>,
    table: Table,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum Notification {
    ConnectPlayer{player_number: usize},
    DisconnectPlayer{player_number: usize},
    PlayerNumber{player_number: usize},
    Table{table: Table},
    UpdateComponent{component_id: usize, component: Component},
    SelectComponent{component_id: usize},
    UnselectComponent{component_id: usize},
    OpenComponent{component_id: usize},
    CloseComponent{component_id: usize},
    IncrementComponent{component_id: usize},
    DecrementComponent{component_id: usize},
    MoveComponent{component_id: usize, x: i32, y: i32},
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
            table: Table::default(),
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
        let player_number = self.players.iter().position(|&r| r == client_id).unwrap() + 1;

        msg.addr.notifies(vec![
            Notification::PlayerNumber{player_number},
            Notification::Table{table: self.table.clone()}
        ]);

        self.sessions.insert(client_id, msg.addr);

        self.send_message(vec![
            Notification::ConnectPlayer{player_number}
        ]);

        client_id
    }
}

impl Handler<Disconnect> for WsActor {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        let client_id = msg.id;
        let player_number = self.players.iter().position(|&r| r == client_id).unwrap() + 1;
        self.send_message(vec![
            Notification::DisconnectPlayer{player_number}
        ]);
        self.sessions.remove(&client_id);
        self.players.retain(|&r| r != client_id);
        self.notify_all_player_numbers();
    }
}

impl Handler<ClientMessage> for WsActor {
    type Result = ();

    fn handle(&mut self, msg: ClientMessage, _: &mut Context<Self>) {
        debug!("Message from client: {}", msg.msg);
        let client_id = msg.id;
        let player_number = self.players.iter().position(|&r| r == client_id).unwrap() + 1;

        match serde_json::from_str::<Notification>(&msg.msg) {
            Ok(notif) => {
                match notif {
                    Notification::SelectComponent{component_id} => {
                        self.table.components[component_id].is_selected = true;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.table.components[component_id].clone()}
                        ]);
                    }
                    Notification::UnselectComponent{component_id} => {
                        self.table.components[component_id].is_selected = false;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.table.components[component_id].clone()}
                        ]);
                    }
                    Notification::OpenComponent{component_id} => {
                        self.table.components[component_id].is_opened = true;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.table.components[component_id].clone()}
                        ]);
                    }
                    Notification::CloseComponent{component_id} => {
                        self.table.components[component_id].is_opened = false;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.table.components[component_id].clone()}
                        ]);
                    }
                    Notification::IncrementComponent{component_id} => {
                        self.table.components[component_id].number += 1;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.table.components[component_id].clone()}
                        ]);
                    }
                    Notification::DecrementComponent{component_id} => {
                        self.table.components[component_id].number -= 1;
                        self.send_message(vec![
                            Notification::UpdateComponent {component_id, component: self.table.components[component_id].clone()}
                        ]);
                    }
                    Notification::MoveComponent{component_id, x, y} => {
                        if let Some(user_number) = self.table.components[component_id].user {
                            if user_number != player_number {
                                debug!("could not move the component");
                                return;
                            }
                        }
                        self.table.components[component_id].x = x;
                        self.table.components[component_id].y = y;
                        self.send_message_except(msg.id, vec![
                            Notification::UpdateComponent {component_id, component: self.table.components[component_id].clone()}
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