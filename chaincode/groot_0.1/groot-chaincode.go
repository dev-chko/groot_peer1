package main  

import (
	"fmt"
	"bytes"
	"encoding/json" // 웹 브라우저와 웹서버 사이에 데이터 교환을 위해 JSON사용(데이터 교환 포맷)
	"strconv"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
)
type SmartContract struct{
 
}

type Protect struct {   
	Technology 		string 	  `json:"technology"`  // 임치 기술 제목
	Sort 			int    	  `json:"sort"`	       // 기술 분야(산업기술표준분류표 참고)
	Company 		string 	  `json:"company"`     // 회사명
	Term 			int	  `json:"term"`        // 임치 기간
	Content			[]string  `json:"content"`     // 임치 데이터의 file별 내용에 대한 hash값(배열)
	Client 			[]string  `json:"client"`      // 사용 회사명(배열)
	Cont_term		[]int	  `json:"cont_term"`   // 계약 기간(Client별 배열)
	Enroll_date		time.Time `json:"enroll_date"` // admin이 최종 승인한 시간(증명서 발급에 필요)
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
	} else if fn == "generate_cert" { // 증명서 발급
		return s.generate_cert(stub, args)
	} else if fn == "verify_doc" { // 문서 검증
		return s.verify_doc(stub, args)
	} else if fn == "get_tech" { // 기술 조회
		return s.get_tech(stub, args)
	} else if fn == "queryAllProtect"{
		return s.queryAllProtect(stub, args)
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
	//     0         1        2       3        4        5          6            7   
	// Technology   Sort   Company   Term   Content   Client   Cont_term   Enroll_date
	if len(args) != 7 { // Enroll_date(admin 승인 전까지 null) 제외하고 나머지 값들은 전부 입력하도록(5, 6번이 없을경우 web에서 null값 입력하도록!)
		return shim.Error("Incorrect number of parameters. Expecting 7")
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
		return shim.Error("4th argument Developer must be a non-empty string\n")
	}
	if len(args[4]) <= 0 {
		return shim.Error("5th argument Client must be a non-empty string\n")
	}
	if len(args[5]) <= 0 {
		return shim.Error("6th argument Term must be a non-empty string\n")
	}
	if len(args[6]) <= 0 {
		return shim.Error("7th argument Content must be a non-empty string\n")
	}

	// 값들을 각 변수에 받아옴
	technology := args[0]
	sort, err := strconv.Atoi(args[1]) // sort 값 숫자로 변환(분류)

	if err != nil {
		return shim.Error("2nd argument sort must be a numeric string\n")
	}
	company := args[2]
	term, err := strconv.Atoi(args[3]) // term 값 숫자로 변환(임치기간)
	if err != nil {
		return shim.Error("4th argument Term must be a numeric string\n")
	}
	content := make([]string,10) // content 배열을 생성하는데 최대 10개 입력 가능
	content = append(content, args[4]) // 임치내용(추후 파일로 변경)  
	client := make([]string, 10) // client 배열을 생성하는데 최대 10개 입력 가능
	client = append(client, args[5]) // 임치된 기술을 사용할 회사들
	cont_term := make([]int, 10) // client별 계약기간 최대 10개 입력 가능
	cont_term, err = strconv.Atoi(args[6]) // cont_term 값 숫자로 변환(계약기간)
	cont_term = append(cont_term, args[6])
	if err != nil {
		return shim.Error("7th argument Term must be a numeric string\n")
	}
       	enroll_date := time.Now().UnixNano() / int64(time.Millisecond)

	// 기존 임치물과 동일할 경우 에러출력
	technologyAsBytes, err := stub.GetState(technology)
	if err != nil {
		return shim.Error("Failed to get technology: " + err.Error())
	} else if technologyAsBytes != nil {
		fmt.Println("This technology already exists: " + technology)
		return shim.Error("This technology already exists: " + technology)
	}

	// 입력받은 값으로 Protect의 object를 만들기
	protect := &Protect{technology, sort, company, term, []string{content}, []string{client}, []int{cont_term}, enroll_date}
	// JSON 형식으로 변환 
	protectJSONasBytes, _ := json.Marshal(protect)
	
	// PutState를 통해 World State에 저장
	err = stub.PutState(technology, protectJSONasBytes) // (key, value)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to record protect : %s", args[0]))
	}

	// 기록 완료 return 
	fmt.Println("- end add contract -\n")
	buffer.WriteString(protect)
	return shim.Success(nil)
}

// 계약 사용자 편입
func(s *SmartContract) add_client(stub shim.ChaincodeStubInterface, args []string) sc.Response {
        // check parameter(Technology, Client, Cont_term) : 기술명을 입력받아 해당 기술의 사용자와 계약기간  추가
        if len(args) != 3 {
                return shim.Error("Incorrect number of arguments. Expecting 3")
        }

        fmt.Println("- start add client -\n")
        if len(args[1]) <= 0 {
                return shim.Error("2nd argument Client must be a non-empty string\n")
        }
        if len(args[2]) <= 0 {
                return shim.Error("3nd argument Client must be a non-empty string\n")
        }


        protectBytes, err := stub.GetState(args[0])
        if err != nil {
		return shim.Error("Failed to get Technology : " + err.Error())
	} else if protectBytes == nil {
                return shim.Error("Technology does not exist")
        }
        new_client := args[1]
	new_term, err := strconv.Atoi(args[2])
        if err != nil {
                return shim.Error("3th argument Term must be a numeric string\n")
        }

        // 입력받은 byte 타입을 JSON형식으로 변환하는데 Protect{}의 구조체를 따른다고 알려줌
        protect := Protect{}
        json.Unmarshal(protectBytes, &protect) // (JSON데이터, 출력할 구조체의 포인터(주소))
	protect.Client = append(protect.Client, new_client) // 기존 client에 추가
	protect.Cont_term = append(protect.Cont_term, new_term) // 추가된 client의 계약기간 추가

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
	// check parameter(Technology, Term) : 기술명을 입력받아 임치기간 수정
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}

	// 필수 입력하도록
        fmt.Println("- start change term -\n")
        if len(args[1]) <= 0 {
                return shim.Error("2nd argument Term must be a non-empty string\n")
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

	// 입력받은 byte 타입을 JSON형식으로 변환하는데 Protect{}의 구조체를 따른다고 알려줌
        protect := Protect{}
        json.Unmarshal(protectBytes, &protect)

	protect.Term = update_term // 임치기간 update(change)

	// JSON형식을 다시 byte 타입으로 변환해 World State에 저장하기
	protectBytes, _ = json.Marshal(protect)
	err = stub.PutState(args[0], protectBytes) // (key, value)
	if err != nil {
               return shim.Error(fmt.Sprintf("Failed to change term: %s", args[0]))
        }

	fmt.Println("- end change term SUCCESS -")
	return shim.Success(nil)
}


// 증명서 발급
func(s *SmartContract) generate_cert(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	return shim.Success(nil)
}

// 문서 검증
func(s *SmartContract) verify_doc(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	return shim.Success(nil)
}

// 기술 조회(query protect)
func(s *SmartContract) get_tech(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	// check parameter count -> 1(technology값을 입력 받아 해당 내용 출력하도록)
	if len(args) != 1 {
		return shim.Error("Incorrect number of parameters. Expecting 1")
	}

	// GetState from World State with the first parameter
	protectBytes, _ := stub.GetState(args[0])

	protect := Protect{}
	json.Unmarshal(protectBytes, &protect)

	var buffer bytes.Buffer

	checkcomma := false
	i := 0

	buffer.WriteString("{\"Protect key\":")
	buffer.WriteString("\"")
	buffer.WriteString(protect.Technology)
	buffer.WriteString("\"")
	buffer.WriteString(",") 
	buffer.WriteString("\"Protect sort\":")
	buffer.WriteString("\"")
	buffer.WriteString(strconv.Itoa(protect.Sort))
	buffer.WriteString("\"")
	buffer.WriteString(",")

	for i=0; i<len(protect.Company); i++ {

		if checkcomma == true buffer.WriteString(",")

		buffer.WriteString("\"Protect company\":")
		buffer.WriteString("\"")
		buffer.WriteString(protect.Company[i].Company)
		buffer.WriteString("\":")
		
		split_company := strings.Split(protect.Company[i].Result, ",") 
		buffer.WriteString("\"Protect term\":")
		buffer.WriteString("\"")
		buffer.WriteString(strconv.Itoa(protect.Term))
		buffer.WriteString("\"")
		buffer.WriteString(",")
		buffer.WriteString("\"Protect content\":")
		buffer.WriteString("\"")
		//buffer.WriteString(protect.Content)
		buffer.WriteString("\"")
		buffer.WriteString(",") 
		buffer.WriteString("\"Protect client\":")
		buffer.WriteString("\"")
		//buffer.WriteString(protect.Client)
		buffer.WriteString("\"")
		buffer.WriteString(",") 
		buffer.WriteString("\"Protect cont_term\":")
		buffer.WriteString("\"")
		//buffer.WriteString(strconv.Itoa(protect.Cont_term))
	}

	buffer.WriteString("\"")
	buffer.WriteString(",")
	buffer.WriteString("\"Protect enroll_date\":")
	buffer.WriteString("\"")
        //enroll_time, _ = json.UnmarshalText(protect.enroll_date)
	fmt.Printf("%s", protect.Enroll_date)
	//buffer.Write(enroll_time)
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
func (s *SmartContract) queryAllProtect(stub shim.ChaincodeStubInterface, args []string) sc.Response {

	// check parameter count -> 2
	if len(args) != 2 {
		return shim.Error("Incorrect number of parameters. Expecting 2")
	}

	// GetState from World State with the first parameter
	startKey, _ := stub.GetState(args[0])
	endKey, _ := stub.GetState(args[1])

	// GetStateByRange함수를 통해 범위에 있는 데이터를 모두 받아옴(https://godoc.org/github.com/hyperledger/fabric/core/chaincode/shim#ChaincodeLogger.Info 참고)
	resultsIterator, err := stub.GetStateByRange(string(startKey), string(endKey))
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

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true // 뒤에 값이 있으면 ,찍고 없으면 안찍음
	}
	buffer.WriteString("]")

	fmt.Printf("- queryAllProtect:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}
