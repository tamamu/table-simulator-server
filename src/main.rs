use actix::prelude::*;
use actix_web::{web, App, Error, HttpRequest, HttpResponse, HttpServer};
use actix_web_actors::ws;
use actix_files as fs;
use std::time::{Duration, Instant};
use log::{debug, error, log_enabled, info, Level};
use table_simulator_server::ws::WsActor;
use env_logger::Env;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

struct WsSession {
    id: u32,
    hb: Instant,
    addr: Addr<WsActor>,
}

impl WsSession {
    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                error!("Websocket Client heartbeat failed, disconnecting!");
                act.addr.do_send(
                    table_simulator_server::ws::Disconnect {
                        id: act.id
                    }
                );
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        info!("websocket session started!");
        self.hb(ctx);

        let addr = ctx.address();
        self.addr
            .send(table_simulator_server::ws::Connect {
                addr: addr.recipient(),
            })
            .into_actor(self)
            .then(|res, act, ctx| {
                match res {
                    Ok(res) => act.id = res,
                    _ => ctx.stop(),
                }
                fut::ready(())
            })
            .wait(ctx);
    }

    fn stopping(&mut self, _: &mut Self::Context) -> Running {
        self.addr
            .do_send(table_simulator_server::ws::Disconnect {
                id: self.id,
            });
        Running::Stop
    }
}

impl Handler<table_simulator_server::ws::Message> for WsSession {
    type Result = ();

    fn handle(&mut self, msg: table_simulator_server::ws::Message, ctx: &mut Self::Context) {
        match serde_json::to_string(&msg.0) {
            Ok(text) => ctx.text(text),
            Err(e) => error!("{}", e)
        }
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        let msg = match msg {
            Err(_) => {
                ctx.stop();
                return;
            }
            Ok(msg) => msg,
        };

        match msg {
            ws::Message::Ping(msg) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            ws::Message::Pong(_) => {
                self.hb = Instant::now();
            }
            ws::Message::Text(text) => {
                let m = text.trim();

                self.addr
                    .do_send(table_simulator_server::ws::ClientMessage {
                        id: self.id,
                        msg: m.to_string(),
                    })
            }
            ws::Message::Binary(_) => println!("Unexpected binary"),
            ws::Message::Close(_) => {
                ctx.stop();
            }
            ws::Message::Continuation(_) => {
                ctx.stop();
            }
            ws::Message::Nop => (),
        }
    }
}

pub async fn ws_route(
    req: HttpRequest,
    stream: web::Payload,
    srv: web::Data<Addr<WsActor>>,
) -> Result<HttpResponse, Error> {
    ws::start(
        WsSession {
            id: 0,
            hb: Instant::now(),
            addr: srv.get_ref().clone(),
        },
        &req,
        stream,
    )
}

#[actix_rt::main]
async fn main() -> std::io::Result<()> {
    env_logger::Builder::from_env(Env::default().default_filter_or("debug")).init();

    let ws_server = WsActor::new().start();
    HttpServer::new(move || {
        App::new()
            .data(ws_server.clone())
            .service(web::resource("/").route(web::get().to(|| {
                HttpResponse::Found()
                    .header("LOCATION", "/static/index.html")
                    .finish()
            })))
            .service(web::resource("/ws/").to(ws_route))
            .service(fs::Files::new("/static/", "web/public/"))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
