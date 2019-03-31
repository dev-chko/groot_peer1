package main  

import (
	"fmt"
	"bytes"
	"encoding/json" // 웹 브라우저와 웹서버 사이에 데이터 교환을 위해 JSON사용(데이터 교환 포맷)
	"strconv"
	"time"
	"strings" // split 하기 위해 넣어주는 모듈

	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
)
type SmartContract struct{
 
}

type Protect struct {   
	Technology 		string		   `json:"technology"`		// 임치 기술 제목
	Sort 			int		   `json:"sort"`		// 기술 분야(산업기술표준분류표 참고)
	Company 		string		   `json:"company"`	        // 회사명
	Com_num			int		   `json:"com_num"`	        // 회사의 사업자 등록 번호
	Term 			int		   `json:"term"`		// 임치 기간
	Content			map[string]string  `json:"content"`		// 임치 데이터의 file별 내용에 대한 hash값(map)
	Client 			map[string]int	   `json:"client,omitempty"`    // 사용 회사명(map) : null값이 될 수도 있으므로 omitempty 속성 부여
	Enroll_date		string		   `json:"enroll_date"`		// admin이 최종 승인한 시간(증명서 발급에 필요)
	Status			int		   `json:"status"`		// 증명서 발급에 쓰기 위한 상태값(등록, 갱신, 연장, 편입, 검증, 조회 - 순서대로 1~6의 값)
}

func main(){
	err := shim.Start(new(SmartContract))
	if err != nil{
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}

func (s *SmartContract) Init(stub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}

func (s *SmartContract) Invoke(stub shim.ChaincodeStubInterface) sc.Response {
	fn, args := stub.GetFunctionAndParameters()
	fmt.Println("invoke is running " + fn)

	if fn == "init"{ // 원장 초기화
		return s.init(stub)
	} else if fn == "add_cont" { // 기술(계약서) 등록
		return s.add_cont(stub, args)
	} else if fn == "add_client" { // 계약 사용자 편입
		return s.add_client(stub, args)
	} else if fn == "change_term" { // 기술 연장
		return s.change_term(stub, args)
	} else if fn == "add_content" { // 기술 갱신(추가)
		return s.add_content(stub, args)
	} else if fn == "get_cert_verify" { // 임치 및 계약증명서 발급과 문서 원본검증을 위한 GetHistoryForKey
		return s.get_cert_verify(stub, args)
	} else if fn == "get_tech" { // 기술 조회
		return s.get_tech(stub, args)
	} else if fn == "get_all_tech"{ // groot_scan을 위한 모든 기술 조회
		return s.get_all_tech(stub)
	} else {
		fmt.Println("invoke did not find functinon " + fn)
		return shim.Error("Invaild Function Name")
	}
}

func (s *SmartContract) init(stub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}

// 기술(계약서) 등록(record protect)
func(s *SmartContract) add_cont(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	//     0         1        2         3        4        5           6         7 	       8            9          10 
	// Technology   Sort   Company   Com_num   Term   file_name   file_hash   Client   Cont_term   Enroll_date   Status
	if len(args) != 9 { // web에서 값 넘겨받기(client, cont_term 제외한 나머지 값)
		return shim.Error("Incorrect number of parameters. Expecting 9")
	}

	// 필수 입력하도록
	fmt.Println("- start add contract -\n")
	if len(args[0]) <= 0 {
		return shim.Error("1st argument Technology must be a non-empty string\n")
	}
	if len(args[1]) <= 0 {
		return shim.Error("2nd argument Sort must be a non-empty string\n")
	}
	if len(args[2]) <= 0 {
		return shim.Error("3rd argument Company must be a non-empty string\n")
	}
	if len(args[3]) <= 0 {
		return shim.Error("4th argument Com_num must be a non-empty string\n")
	}
	if len(args[4]) <= 0 {
		return shim.Error("5th argument Term must be a non-empty string\n")
	}
	if len(args[5]) <= 0 {
		return shim.Error("6th argument File_name must be a non-empty string\n")
	}
	if len(args[6]) <= 0 {
		return shim.Error("7th argument File_hash must be a non-empty string\n")
	}
	if len(args[7]) <= 0 {
		return shim.Error("8th argument Enroll_date must be a non-empty string\n")
	}
	if len(args[8]) <= 0 {
		return shim.Error("9th argument Status must be a non-empty string\n")
	}

	// 값들을 각 변수에 받아옴
	technology := args[0]
	sort, err := strconv.Atoi(args[1]) // sort 값 숫자로 변환(분류)
	if err != nil {
		return shim.Error("2nd argument Sort must be a numeric string\n")
	}
	company := args[2]
	com_num, err := strconv.Atoi(args[3]) // term 값 숫자로 변환(임치기간)
	if err != nil {
		return shim.Error("4th argument Company number must be a numeric string\n")
	}
	term, err := strconv.Atoi(args[4]) // term 값 숫자로 변환(임치기간)
	if err != nil {
		return shim.Error("5th argument Term must be a numeric string\n")
	}
	content := make(map[string]string)
	// content가 여러개 들어올 경우 key-value 맞춰서 블록에 쌓아줘야 함
	file_name := strings.Split(args[5], ",")
	file_hash := strings.Split(args[6], ",")
	for i:=0; i<len(file_name) && i<len(file_hash); i++ {
	    content[file_name[i]] = file_hash[i]
	}
	client := make(map[string]int)
	enroll_date := args[7]
	status, err := strconv.Atoi(args[8]) // status값 순자로 변환(상태)
	if err != nil {
		return shim.Error("9th argument Status must be a numeric string\n")
	}

	// 기존 임치물과 동일할 경우 에러출력
	technologyAsBytes, err := stub.GetState(technology)
	if err != nil {
		return shim.Error("Failed to get technology: " + err.Error())
	} else if technologyAsBytes != nil {
		fmt.Println("This technology already exists: " + technology)
		return shim.Error("This technology already exists: " + technology)
	}

	// 입력받은 값으로 Protect의 object를 만들기
	protect := &Protect{technology, sort, company, com_num, term, content, client, enroll_date, status}
	// JSON 형식으로 변환
	protectJSONasBytes, _ := json.Marshal(protect)
	// PutState를 통해 World State에 저장
	err = stub.PutState(technology, protectJSONasBytes) // (key, value)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to record protect : %s", args[0]))
	}

	var buffer bytes.Buffer

	// 기록 완료 return 
	fmt.Println("- end add contract -\n")
	buffer.Write(protectJSONasBytes)
	return shim.Success(nil)
}

// 계약 사용자 편입
func(s *SmartContract) add_client(stub shim.ChaincodeStubInterface, args []string) sc.Response {
        // check parameter(Technology, Client, Cont_term, Status) : 기술명을 입력받아 해당 기술의 사용자와 계약기간  추가
        if len(args) != 4 {
                return shim.Error("Incorrect number of arguments. Expecting 4")
        }

        fmt.Println("- start add client -\n")
        if len(args[1]) <= 0 {
                return shim.Error("2nd argument Client must be a non-empty string\n")
        }
        if len(args[2]) <= 0 {
                return shim.Error("3nd argument Contract Term must be a non-empty string\n")
        }
        if len(args[3]) <= 0 {
                return shim.Error("4nd argument Status must be a non-empty string\n")
        }

        protectBytes, err := stub.GetState(args[0])
        if err != nil {
		return shim.Error("Failed to get Technology : " + err.Error())
	} else if protectBytes == nil {
                return shim.Error("Technology does not exist")
        }
	cont_term, err := strconv.Atoi(args[2]) // cont_term 값 숫자로 변환(계약기간)
	if err != nil {
	    return shim.Error("3th argument Contract term must be a numeric string\n")
	}
	status, err := strconv.Atoi(args[3]) // status값 순자로 변환(상태)
	if err != nil {
		return shim.Error("4th argument Status must be a numeric string\n")
	}

        // 입력받은 byte 타입을 JSON형식으로 변환하는데 Protect{}의 구조체를 따른다고 알려줌
        protect := Protect{}
        json.Unmarshal(protectBytes, &protect) // (JSON데이터, 출력할 구조체의 포인터(주소))

	if protect.Client == nil {
	    client := make(map[string]int)
	    client[args[1]] = cont_term
	    protect.Client = client
	}
	protect.Client[args[1]] = cont_term
	protect.Status = status

        // 구조체를 JSON형식으로 인코딩해 byte배열로  World State에 저장하기(byte slice로 return)
        protectBytes, _ = json.Marshal(protect)
        err = stub.PutState(args[0], protectBytes) // (key, value)
        if err != nil {
               return shim.Error(fmt.Sprintf("Failed to add client : %s", args[0]))
        }

	fmt.Println("- end add client SUCCESS -")
	return shim.Success(nil)
}

// 기술 연장
func(s *SmartContract) change_term(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	// check parameter(Technology, Term, Status) : 기술명을 입력받아 임치기간 수정
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3")
	}

	// 필수 입력하도록
        fmt.Println("- start change term -\n")
        if len(args[1]) <= 0 {
                return shim.Error("2nd argument Term must be a non-empty string\n")
        }
        if len(args[2]) <= 0 {
                return shim.Error("3nd argument Status must be a non-empty string\n")
        }

        protectBytes, err := stub.GetState(args[0])
        if err != nil {
                return shim.Error("Failed to get Technology : " + err.Error())
        } else if protectBytes == nil {
                return shim.Error("Technology does not exist")
        }
	update_term, err := strconv.Atoi(args[1]) // term 값 숫자로 변환(임치기간)
        if err != nil {
                return shim.Error("2th argument Term must be a numeric string\n")
        }
	status, err := strconv.Atoi(args[2]) // status 값 숫자로 변환(상태값)
        if err != nil {
                return shim.Error("3th argument Status must be a numeric string\n")
        }

	// 입력받은 byte 타입을 JSON형식으로 변환하는데 Protect{}의 구조체를 따른다고 알려줌
        protect := Protect{}
        json.Unmarshal(protectBytes, &protect)

	protect.Term = update_term // 임치기간 update(change)
	protect.Status = status

	// JSON형식을 다시 byte 타입으로 변환해 World State에 저장하기
	protectBytes, _ = json.Marshal(protect)
	err = stub.PutState(args[0], protectBytes) // (key, value)
	if err != nil {
               return shim.Error(fmt.Sprintf("Failed to change term: %s", args[0]))
        }

	fmt.Println("- end change term SUCCESS -")
	return shim.Success(nil)
}

// 기술 갱신(추가)
func(s *SmartContract) add_content(stub shim.ChaincodeStubInterface, args []string) sc.Response {
        // check parameter(Technology, File_name, File_hash, Status) : 기술명을 입력받아 해당 기술의 내용을 추가
        if len(args) != 4 {
                return shim.Error("Incorrect number of arguments. Expecting 4")
        }

        fmt.Println("- start add content -\n")
        if len(args[1]) <= 0 {
                return shim.Error("2nd argument File_name must be a non-empty string\n")
        }
        if len(args[2]) <= 0 {
                return shim.Error("3nd argument File_hash must be a non-empty string\n")
        }
        if len(args[3]) <= 0 {
                return shim.Error("4nd argument Status must be a non-empty string\n")
	}

        protectBytes, err := stub.GetState(args[0])
        if err != nil {
		return shim.Error("Failed to get Technology : " + err.Error())
	} else if protectBytes == nil {
                return shim.Error("Technology does not exist")
        }
//	new_content := make(map[string]string)
//	new_content[args[1]] = args[2]
	status, err := strconv.Atoi(args[3]) // status 값 숫자로 변환(상태값)
        if err != nil {
                return shim.Error("4th argument Status must be a numeric string\n")
        }

        // 입력받은 byte 타입을 JSON형식으로 변환하는데 Protect{}의 구조체를 따른다고 알려줌
        protect := Protect{}
        json.Unmarshal(protectBytes, &protect) // (JSON데이터, 출력할 구조체의 포인터(주소))
	protect.Content[args[1]] = args[2]
//	protect.Content = new_content // 기존 content에 추가
	protect.Status = status

        // 구조체를 JSON형식으로 인코딩해 byte배열로  World State에 저장하기(byte slice로 return)
        protectBytes, _ = json.Marshal(protect)
        err = stub.PutState(args[0], protectBytes) // (key, value)
        if err != nil {
               return shim.Error(fmt.Sprintf("Failed to add content : %s", args[0]))
        }

	fmt.Println("- end add content SUCCESS -")
	return shim.Success(nil)
}

// 임치증명서 발급 및 문서 원본검증을 위한 GetHistoryForKey
func(s *SmartContract) get_cert_verify(stub shim.ChaincodeStubInterface, args []string) sc.Response{
	// check parameter count -> 1(technology값을 입력 받아 해당 내용 출력하도록)
	//     0         1        2         3        4       5        6          7 	     8           9
	// Technology   Sort   Company   Com_num   Term   Content   Client   Cont_term   Enroll_date   Status
	if len(args) != 1 {
		return shim.Error("Incorrect number of parameters. Expecting 1")
	}

	technology := args[0]
	fmt.Printf("- start get_cert_verify : %s\n", technology)

	resultsIterator, err := stub.GetHistoryForKey(technology) // 시간에 따른 키 값의 내역을 반환(TxID와 Timestamp를 반환), query이므로 읽기전용에 사용해야 함
	if err != nil {
	    return shim.Error(err.Error())
	}
	defer resultsIterator.Close() // 흐름 제어문

	// buffer에 technology의 history를  JSON array로 표시
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
                response, err := resultsIterator.Next()
                if err != nil {
                        return shim.Error(err.Error())
                }
                // Add a comma before array members, suppress it for the first array member
                if bArrayMemberAlreadyWritten == true {
                        buffer.WriteString(",")
                }
                buffer.WriteString("{\"TxId\":")
                buffer.WriteString("\"")
                buffer.WriteString(response.TxId)
                buffer.WriteString("\"")

                buffer.WriteString(", \"Value\":")
                // if it was a delete operation on given key, then we need to set the
                // corresponding value null. Else, we will write the response.Value
                // as-is (as the Value itself a JSON technology)
                if response.IsDelete {
                        buffer.WriteString("null")
	        } else {
                        buffer.WriteString(string(response.Value))
                }

                buffer.WriteString(", \"Timestamp\":")
                buffer.WriteString("\"")
                buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
                buffer.WriteString("\"")

                buffer.WriteString(", \"IsDelete\":")
                buffer.WriteString("\"")
                buffer.WriteString(strconv.FormatBool(response.IsDelete))
                buffer.WriteString("\"")

                buffer.WriteString("}")
                bArrayMemberAlreadyWritten = true
        }
        buffer.WriteString("]")

	fmt.Printf("- get_cert_verify returning: \n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

// 기술 조회(query protect)
func(s *SmartContract) get_tech(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	// check parameter count -> 1(technology값을 입력 받아 해당 내용 출력하도록)
	//     0         1        2         3        4       5        6          7 	     8           9
	// Technology   Sort   Company   Com_num   Term   Content   Client   Cont_term   Enroll_date   Status

	if len(args) != 1 {
		return shim.Error("Incorrect number of parameters. Expecting 1")
	}

	// GetState from World State with the first parameter
	protectBytes, _ := stub.GetState(args[0])

	protect := Protect{}
	json.Unmarshal(protectBytes, &protect) // (JSON데이터, 출력하고자하는 구조체)를 Unmarshal 통해 디코딩

	var buffer bytes.Buffer
	checkcomma := false

	buffer.WriteString("{\"Protect key\":")
	buffer.WriteString("\"")
	buffer.WriteString(protect.Technology)
	buffer.WriteString("\"")
	buffer.WriteString(",")
	buffer.WriteString("\"sort\":")
	buffer.WriteString("\"")
	buffer.WriteString(strconv.Itoa(protect.Sort))
	buffer.WriteString("\"")
	buffer.WriteString(",")
	buffer.WriteString("\"company\":")
	buffer.WriteString("\"")
	buffer.WriteString(protect.Company)
	buffer.WriteString("\"")
	buffer.WriteString(",")
	buffer.WriteString("\"company_number\":")
	buffer.WriteString("\"")
	buffer.WriteString(strconv.Itoa(protect.Com_num))
	buffer.WriteString("\"")
	buffer.WriteString(",")
	buffer.WriteString("\"term\":")
	buffer.WriteString("\"")
	buffer.WriteString(strconv.Itoa(protect.Term))
	buffer.WriteString("\"")
	buffer.WriteString(",")
	buffer.WriteString("\"content\":")
	buffer.WriteString("\"{")

	for key, value := range protect.Content {
		if checkcomma == true {
		    buffer.WriteString(",")
		}
		buffer.WriteString(key)
		buffer.WriteString(":")
		buffer.WriteString(value)
		checkcomma = true
	}
	buffer.WriteString("\"}")
	buffer.WriteString(",") 

	buffer.WriteString("\"client:contract_term\":")
	buffer.WriteString("\"{")

	for key, value := range protect.Client {
		if checkcomma == true {
		    buffer.WriteString(",")
		}
		buffer.WriteString(key)
		buffer.WriteString(":") 
		buffer.WriteString(strconv.Itoa(value))
		checkcomma = true
	}
	buffer.WriteString("\"}")
	buffer.WriteString(",") 

	buffer.WriteString("\"enroll_date\":")
	buffer.WriteString("\"")
	buffer.WriteString(protect.Enroll_date)
	buffer.WriteString("\"")

	buffer.WriteString("\"status\":")
	buffer.WriteString("\"")
	buffer.WriteString(strconv.Itoa(protect.Status))
	buffer.WriteString("\"")
	buffer.WriteString("}")

	/*	
		The defer keyword will let the function defined next to defer be conducted.
		It is very similar to 'finally' in other programing languages.
		In the last terms of this function , defer func will be executed.
	*/

	fmt.Printf("- Data of protect :\n%s\n", buffer.String())

	if protectBytes == nil {
		return shim.Error("Could not find protect data")
	} else {
		// return shim.Success(protectBytes)
		return shim.Success(buffer.Bytes())
	}
	// return shim.Success(buffer.Bytes())
}

// 모든 기술 조회(query all protect)_test용
func (s *SmartContract) get_all_tech(stub shim.ChaincodeStubInterface) sc.Response {

	startKey:=""
	endKey:=""

	// GetStateByRange함수를 통해 범위에 있는 데이터를 모두 받아옴(https://godoc.org/github.com/hyperledger/fabric/core/chaincode/shim#ChaincodeLogger.Info 참고)
	resultsIterator, err := stub.GetStateByRange(startKey, endKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	// defer는 close의 용도(닫아버리는 것 => 문을 닫았기 때문에 데이터가 추가로 들어와도 이 코드 전까지 받아온 데이터만 인정)
	defer resultsIterator.Close()

	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer
	buffer.WriteString("[")

	// 반복문을 통해 범위에 있는 모든 데이터들 받아오면서(HasNext()함수 이용) buffer에 출력
	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add comma before array members,suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

//	        buffer.WriteString(", \"TxId\":")
//                buffer.WriteString("\"")
//                buffer.WriteString(queryResponse.TxId)
//                buffer.WriteString("\"")

		buffer.WriteString(", \"Value\":")
		// Record is a JSON object, so we write as-is
//		if queryResponse.IsDelete {
//                        buffer.WriteString("null")
//	        } else {
		buffer.WriteString(string(queryResponse.Value))
//		}

//                buffer.WriteString(", \"Timestamp\":")
//                buffer.WriteString("\"")
//                buffer.WriteString(time.Unix(queryResponse.Timestamp.Seconds, int64(queryResponse.Timestamp.Nanos)).String())
//                buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true // 뒤에 값이 있으면 ,찍고 없으면 안찍음
	}
	buffer.WriteString("]")

	fmt.Printf("- get All Technology:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}
